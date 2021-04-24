import { Schema, model } from 'mongoose';
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
import mapSeries from 'async/mapSeries';

const { debug } = log('schema');

const INTERNAL_FIELDS_RE = /^_/;
const omitInternal = fpOmitBy((val, key) => INTERNAL_FIELDS_RE.test(key));
const pickUndefined = obj => mapValues(pickBy(obj, val => val === undefined), () => 1);

export default class ModelSchema {

  /**
   * @returns {Schema}
   */
  mongooseSchema() {
    return this.schema;
  }

  /**
   * @returns {Model}
   */
  model() {
    return model(this.name, this.schema);
  }

  constructor(config) {

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
    schema.options.collection = collection;
    schema.add({
      ts: Date,
      id: String,
      cts: Date,
    })

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */

    schema.set('toJSON', {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
      },
    });

    schema.set('tsType', tsType || 'date');

    schema.statics = {
      merge: this.merge,
      mergeIfChanged: this.mergeIfChanged,
      mergeIfNotMatched: this.mergeIfNotMatched,
      normalizeItem: this.normalizeItem,
      findAll: this.findAll,
      ...statics,
      ownFields: omitInternal(schema.tree),
    };

    const pk = mapValues(keyBy(mergeBy), () => 1);
    debug(collection, pk);
    schema.index(pk, { unique: true });

    indexes.push({ ts: -1 });
    each(schemaConfig, (type, key) => key.match(/.+Id$/) && indexes.push({ [key]: 1 }));

    each(indexes, index => schema.index(index));

    this.schema = schema;
    schema.statics.mergeBy = mergeBy;

  }

  normalizeItem(item, defaults = {}, overrides = {}) {
    const { schema: { tree } } = this;
    const all = mapValues(tree, (keySchema, key) => overrides[key] || item[key] || defaults[key]);
    return omitInternal(all);
  }

  /**
   * Merges an array of collection data into the model
   * @param {Array} items
   * @param {Object} [defaults]
   * @returns {Promise<Array>}
   */
  async merge(items, defaults) {

    const ids = [];

    const timestamp = new Date();

    const ops = items.map(item => {

      const { id = uuid() } = item;

      ids.push(id);

      const updateOne = $updateOne.call(this, item, id);
      Object.assign(updateOne.update, {
        timestamp,
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
   * @param {Array} items
   * @param {Object} [defaults]
   * @returns {Promise<Array>}
   */
  async mergeIfChanged(items, upsert = true) {

    const merged = await mapSeries(items, async item => {

      const { id = uuid() } = item;

      const op = $updateOne.call(this, item, id);

      // debug(op);

      const updated = await this.updateOne(op.filter, op.update, { upsert });

      const { nModified, upserted } = updated;

      if (nModified || upserted) {
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
   * @param {Array} items
   * @param {Object} [defaults]
   * @returns {Promise<Array>}
   */
  async mergeIfNotMatched(items, upsertFn = () => true, conditionsFn = () => true) {

    const operations = items.map(item => {

      const { id = uuid() } = item;
      const op = $updateOne.call(this, item, id, upsertFn(item));

      op.update.$currentDate = $currentDate.call(this);

      return op;

    });

    const $or = lo.map(operations, 'filter');

    const existing = await this.find({ $or });

    const create = lo.filter(operations, ({ filter, upsert }) => {
      const item = lo.find(existing, filter);
      return !item && upsert;
    });

    if (create.length) {
      await this.bulkWrite(create.map(updateOne => ({ updateOne })), { ordered: false });
      debug('mergeIfNotMatched:created', create.length);
    }

    // debug('create', create.length);

    const update = lo.filter(operations, ({ filter, update: { $set } }) => {
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

  async findAll(filters, pageSize = 10) {

    const pipeline = [];
    const { schema } = this;

    if (Object.keys(filters).length) {
      pipeline.push({ $match: filters });
    }

    const { getManyPipeline } = this;

    if (getManyPipeline) {
      pipeline.push(...getManyPipeline());
    }

    const $project = {
      ...lo.mapValues(schema.tree, () => true),
      _id: false,
    };

    if (schema.get('tsType') === 'timestamp') {
      $project.ts = { $toDate: { $dateToString: { date: '$ts' } } };
      $project['x-offset'] = '$ts';
      pipeline.push({ $sort: { ts: 1 } });
    }

    pipeline.push({ $project });

    const res = await this.aggregate(pipeline)
      .limit(pageSize);

    return lo.map(res, item => ({
      ...lo.mapValues(this.ownFields, ({ default: d }) => d === undefined ? null : d),
      ...item,
    }));

  }

}

function $updateOne(item, id, upsert = true) {

  const cts = new Date();
  const { mergeBy } = this;
  const toOmit = ['_id', 'ts', 'cts', 'creatorAuthId', ...mergeBy];
  const $set = omit(item, toOmit);
  const $unset = pickUndefined($set);
  const { creatorAuthId } = item;

  const update = {
    $set: omit($set, Object.keys($unset)),
    $unset,
    $setOnInsert: { cts, id, creatorAuthId },
  };

  if (!creatorAuthId) {
    delete update.$setOnInsert.creatorAuthId;
  }

  if (!Object.keys($unset).length) {
    delete update.$unset;
  }

  if (!Object.keys(update.$set).length) {
    delete update.$set;
  }

  return {
    filter: pick({ ...item, id }, mergeBy),
    update,
    upsert,
  };

}

function $currentDate() {
  return { ts: { $type: this.schema.get('tsType') } };
}
