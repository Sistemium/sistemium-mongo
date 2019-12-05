import { Schema, model } from 'mongoose';
import each from 'lodash/each';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import mapValues from 'lodash/mapValues';
import keyBy from 'lodash/keyBy';
import log from 'sistemium-telegram/services/log';
import uuid from 'uuid/v4';
import lo from 'lodash';
import { mapSeriesAsync } from 'sistemium-telegram/services/async';

const { debug } = log('schema');

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
      schema: schemaConfig,
      statics = {},
      indexes = [],
      mergeBy = ['id'],
      tsType,
    } = config;

    this.name = collection;

    Object.assign(schemaConfig, {
      ts: Date,
      id: String,
      cts: Date,
    });

    const schema = new Schema(schemaConfig, { collection });

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
      findAll: this.findAll,
      ...statics,
    };

    const pk = mapValues(keyBy(mergeBy), () => 1);

    debug(collection, pk);

    indexes.push(pk);
    indexes.push({ ts: -1 });

    each(indexes, index => schema.index(index));

    this.schema = schema;
    schema.statics.mergeBy = mergeBy;

  }

  /**
   * Merges an array of collection data into the model
   * @param {Array} items
   * @param {Object} [defaults]
   * @returns {Promise<Array>}
   */
  async merge(items, defaults) {

    const ids = [];

    // debug(items);

    const ops = items.map(item => {

      const { id = uuid() } = item;

      ids.push(id);

      const updateOne = $updateOne.call(this, item, id);
      updateOne.update.$currentDate = $currentDate.call(this);

      return { updateOne };

    });

    // debug(JSON.stringify(ops));

    await this.bulkWrite(ops, { ordered: false });

    return ids;

  }

  /**
   * Merges an array of collection data into the model
   * @param {Array} items
   * @param {Object} [defaults]
   * @returns {Promise<Array>}
   */
  async mergeIfChanged(items) {

    const merged = await mapSeriesAsync(items, async item => {

      const { id = uuid() } = item;

      const op = $updateOne.call(this, item, id);

      // debug(op);

      const updated = await this.updateOne(op.filter, op.update, { upsert: true });

      const { nModified, upserted } = updated;

      if (nModified || upserted) {
        await this.updateOne({ id }, { $currentDate: $currentDate.call(this) });
        return id;
      }

      // debug('not modified', id);
      return null;

    });

    return lo.filter(merged);

  }

  findAll(filters, pageSize = 10) {

    const pipeline = [];
    const { schema } = this;

    if (Object.keys(filters).length) {
      pipeline.push({ $match: filters });
    }

    // debug(lo.mapValues(schema.tree, true));

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

    return this.aggregate(pipeline)
      .limit(pageSize);

  }

}

function $updateOne(item, id) {

  const cts = new Date();
  const { mergeBy } = this;
  const toOmit = ['ts', 'cts', ...mergeBy];

  return {
    filter: pick({ ...item, id }, mergeBy),
    update: {
      $set: { timestamp: cts, ...omit(item, toOmit) },
      $setOnInsert: { cts },
    },
    upsert: true,
  };

}

function $currentDate() {
  return { ts: { $type: this.schema.get('tsType') } };
}
