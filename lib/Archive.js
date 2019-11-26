import log from 'sistemium-telegram/services/log';

import ModelSchema from './schema';

const { debug } = log('archive');

const schema = new ModelSchema({
  collection: 'Archive',
  schema: {
    name: String,
    data: Object,
  },
  indexes: [],
});

export const Archive = schema.model();

async function archiveCreate(data, name) {
  const $set = { name, data };
  const $currentDate = { ts: { $type: 'timestamp' } };
  return Archive.updateOne({ id: data.id, name }, { $set, $currentDate }, { upsert: true });
}

export function delHandler(model) {

  return async ctx => {

    const { path, params: { id } } = ctx;

    ctx.assert(id, 400, 'Need an ID to perform DELETE');

    debug('DELETE', path);

    const data = await model.findOne({ id });

    ctx.assert(data, 404);

    await archiveCreate(data, model.schema.options.collection);
    await data.delete();

    ctx.body = '';
    ctx.status = 204;

  };

}
