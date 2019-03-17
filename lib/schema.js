import { Schema, model } from 'mongoose';
import each from 'lodash/each';
import omit from 'lodash/omit';

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

    indexes.push({ ts: -1 });
    indexes.push({ id: 1 });

    each(indexes, index => schema.index(index));

    this.schema = schema;

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

  const ops = items.map(item => {

    const { id } = item;

    return {
      updateOne: {
        filter: { id },
        update: {
          $set: omit(item, ['id', 'ts', 'cts']),
          $currentDate: { ts: true },
          $setOnInsert: { cts },
        },
        upsert: true,
      },
    };

  });

  return this.bulkWrite(ops, { ordered: false });

}
