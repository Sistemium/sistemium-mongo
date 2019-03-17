import { Schema, model } from 'mongoose';
import each from 'lodash/each';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import mapValues from 'lodash/mapValues';
import keyBy from 'lodash/keyBy';
import log from 'sistemium-telegram/services/log';

const { debug } = log('schema');

export default class ModelSchema {

  mongooseSchema() {
    return this.schema;
  }

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

    schema.statics = Object.assign({ merge }, statics);

    const pk = mapValues(keyBy(mergeBy), () => 1);

    debug(collection, pk);

    indexes.push(pk);
    indexes.push({ ts: -1 });

    each(indexes, index => schema.index(index));

    this.schema = schema;
    schema.statics.mergeBy = mergeBy;

  }

}


/**
 * Merges an array of collection data into the model
 * @param {Array} items
 * @param {Object} [defaults]
 * @returns {Promise}
 */
export async function merge(items, defaults) {

  const cts = new Date();
  const { mergeBy } = this;
  const toOmit = ['ts', 'cts', ...mergeBy];

  const ops = items.map(item => {

    return {
      updateOne: {
        filter: pick(item, mergeBy),
        update: {
          $set: omit(item, toOmit),
          $currentDate: { ts: true },
          $setOnInsert: { cts },
        },
        upsert: true,
      },
    };

  });

  return this.bulkWrite(ops, { ordered: false });

}
