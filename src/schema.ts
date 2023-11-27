import { Schema, model } from 'mongoose';
import type { Model } from 'mongoose';
import each from 'lodash/each';
import omit from 'lodash/omit';
import fpOmitBy from 'lodash/fp/omitBy';
import pick from 'lodash/pick';
import pickBy from 'lodash/pickBy';
import mapValues from 'lodash/mapValues';
import keyBy from 'lodash/keyBy';
import log from 'sistemium-debug';
import { v4 as uuid } from 'uuid';
import lo from 'lodash';
import { mapSeries } from 'async';

export const PAGE_SIZE_HEADER = 'x-page-size';

const { debug } = log('schema');

const INTERNAL_FIELDS_RE = /^_/;
const omitInternal = fpOmitBy((_val, key) => INTERNAL_FIELDS_RE.test(key));
const pickUndefined = (obj: BaseItem) => mapValues(pickBy(obj, val => val === undefined), () => 1);

export type TSType = 'timestamp' | 'date'

export interface ModelSchemaConfig {
  schema: Record<string, any>
  collection: string
  mongoSchema?: Schema,
  statics?: Record<string, any>
  indexes?: Record<string, 1 | -1>[]
  mergeBy?: string[]
  tsType?: TSType
}

export type BaseItem = Record<string, any>

export type MongoModel = ModelSchema & Model<any>

export type TestFn = (item: BaseItem) => boolean
export type ConditionFn = (item: BaseItem, updated: BaseItem) => boolean

export default class ModelSchema {

  schema: Schema & { tree: BaseItem, get(t: 'tsType'): TSType }
  name: string
  getManyPipeline?: () => BaseItem[]
  ownFields: BaseItem
  mergeBy: string[]
  fetchPaged: any
  rolesFilter?(state: BaseItem): BaseItem[]

  mongooseSchema() {
    return this.schema;
  }

  model(): MongoModel {
    return model(this.name, this.schema) as undefined;
  }

  constructor(config: ModelSchemaConfig) {

    const {
      collection,
      schema: schemaConfig = {},
      mongoSchema,
      statics = {},
      indexes = [],
      mergeBy = ['id'],
      tsType,
    } = config;

    this.name = collection;

    // Object.assign(schemaConfig, );

    const schema = mongoSchema || new Schema(schemaConfig);
    schema.set('collection', collection);
    schema.add({
      ts: Date,
      id: String,
      cts: Date,
    });

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */

    schema.set('toJSON', {
      virtuals: true,
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
      },
    });

    // @ts-ignore
    schema.set('tsType', tsType || 'date');

    // @ts-ignore
    schema.statics = {
      merge: this.merge,
      mergeIfChanged: this.mergeIfChanged,
      mergeIfNotMatched: this.mergeIfNotMatched,
      normalizeItem: this.normalizeItem,
      findAll: this.findAll,
      ...statics,
      // @ts-ignore
      ownFields: omitInternal(schema.tree as BaseItem) as BaseItem,
    };

    const pk = mapValues(keyBy(mergeBy), (): 1 | -1 => 1);
    debug(collection, pk);
    schema.index(pk, { unique: true });

    indexes.push({ ts: -1 });
    each(schemaConfig, (_type, key) => key.match(/.+Id$/) && indexes.push({ [key]: 1 }));

    each(indexes, index => schema.index(index));

    // @ts-ignore
    this.schema = schema;
    // @ts-ignore
    schema.statics.mergeBy = mergeBy;

  }

  normalizeItem(item: BaseItem, defaults = {}, overrides = {}) {
    const { schema: { tree } } = this;
    const all = mapValues(
      tree,
      (_keySchema, key) => ifUndefined(overrides[key], ifUndefined(item[key], defaults[key])),
    );
    return omitInternal(all);
  }

  /**
   * Merges an array of collection data into the model
   */
  async merge(this: MongoModel, items: BaseItem[], options: BaseItem = {}) {

    const ids = [];
    const { patch = false } = options;

    const ops = items.map(item => {

      const { id = uuid() } = item;

      ids.push(id);

      const updateOne = $updateOne.call(this, item, id, true, patch);
      Object.assign(updateOne.update, {
        $currentDate: $currentDate.call(this),
      });

      return { updateOne };

    });

    // debug(JSON.stringify(ops));

    if (ops.length) {
      await this.bulkWrite(ops, { ordered: false });
    }

    return ids;

  }

  /**
   * Merges an array of collection data into the model
   */
  async mergeIfChanged(this: MongoModel, items: BaseItem[], upsert: boolean = true): Promise<(string | null)[]> {

    const merged = await mapSeries(items, async (item: BaseItem) => {

      const { id = uuid() } = item;

      const op = $updateOne.call(this, item, id);

      // debug(op);

      const updated = await this.updateOne(op.filter, op.update, { upsert });

      const {
        modifiedCount,
        upsertedCount,
      } = updated;

      if (modifiedCount || upsertedCount) {
        // debug(JSON.stringify(updated));
        await this.updateOne(op.filter, { $currentDate: $currentDate.call(this) });
        return id;
      }

      // debug('not modified', id);
      return null;

    });

    return lo.filter(merged);

  }

  /**
   * Merges an array of collection data into the model
   */
  async mergeIfNotMatched(this: MongoModel, items: BaseItem[], upsertFn: TestFn = () => true, conditionsFn: ConditionFn = () => true): Promise<any> {

    const operations = items.map(item => {

      const { id = uuid() } = item;
      const op = $updateOne.call(this, item, id, upsertFn(item));

      op.update.$currentDate = $currentDate.call(this);

      return op;

    });

    const $or = lo.map(operations, 'filter');

    const existing = await this.find({ $or });

    const create = lo.filter(operations, ({
      filter,
      upsert,
    }) => {
      const item = lo.find(existing, filter);
      return !item && upsert;
    });

    if (create.length) {
      await this.bulkWrite(create.map(updateOne => ({ updateOne })), { ordered: false });
      debug('mergeIfNotMatched:created', create.length);
    }

    // debug('create', create.length);

    const update = lo.filter(operations, ({
      filter,
      update: { $set },
    }) => {
      const item = lo.find(existing, filter);
      return item && !lo.matches($set)(item) && conditionsFn($set, item);
    });

    if (update.length) {

      // debug('update', JSON.stringify(update[0]));
      // const ex = lo.find(existing, update[0].filter);
      // debug('update', JSON.stringify(ex));
      //
      // throw new Error('break');

      await this.bulkWrite(update.map(updateOne => ({ updateOne })), { ordered: false });
      debug('mergeIfNotMatched:updated', update.length);
    }

    // debug('mergeIfChanged', items.length, existing.length, create.length, update.length);
    //
    // if (!existing.length && !create.length) {
    //   debug(JSON.stringify(operations[0]));
    // }

    return [...create, ...update];

  }

  async findAll(this: MongoModel, filters: BaseItem, options: BaseItem = {}) {

    const { headers: { [PAGE_SIZE_HEADER]: pageSize } = {} as BaseItem } = options;
    const pipeline = [];
    const { schema } = this;

    const arrayFilters = Array.isArray(filters) ? filters : [filters || {}];
    arrayFilters.forEach(filter => Object.keys(filter).length && pipeline.push({ $match: filter }));

    const { getManyPipeline } = this;

    if (getManyPipeline) {
      pipeline.push(...getManyPipeline());
    }

    const $project: BaseItem = {
      ...lo.mapValues(schema.tree, () => true),
      _id: false,
    };

    if (schema.get('tsType') === 'timestamp') {
      $project.ts = { $toDate: { $dateToString: { date: '$ts' } } };
      $project['x-offset'] = '$ts';
      pipeline.push({ $sort: { ts: 1 } });
    }

    pipeline.push({ $project });

    const query = this.aggregate(pipeline);
    if (pageSize) {
      query.limit(parseInt(pageSize, 10));
    }

    const res = await query;

    return lo.map(res, item => ({
      ...lo.mapValues(this.ownFields, ({ default: d }) => (d === undefined ? null : d)),
      ...item,
    }));

  }

}

function $updateOne(item: BaseItem, id: string, upsert = true, patch = false) {

  const cts = new Date();
  const { mergeBy } = this;
  const toOmit = ['_id', 'ts', 'cts', 'creatorAuthId', 'id', ...mergeBy];
  const $set = omit(item, toOmit);
  const $unset = pickUndefined($set);
  const { creatorAuthId } = item;

  const update = {
    $set: omit($set, Object.keys($unset)),
    $unset,
    $setOnInsert: {
      cts,
      id,
      creatorAuthId,
    },
  };

  if (!creatorAuthId) {
    delete update.$setOnInsert.creatorAuthId;
  }

  if (patch || !Object.keys($unset).length) {
    delete update.$unset;
  }

  if (!Object.keys(update.$set).length) {
    delete update.$set;
  }

  return {
    filter: pick({
      ...item,
      id,
    }, mergeBy),
    update,
    upsert,
  };

}

function $currentDate(this: MongoModel) {
  return { ts: { $type: this.schema.get('tsType') } };
}

function ifUndefined(val1: any, val2: any): any {
  return val1 === undefined ? val2 : val1;
}
