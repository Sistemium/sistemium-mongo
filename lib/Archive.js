import log from 'sistemium-debug';

import ModelSchema from './schema';

const { debug } = log('archive');

const schema = new ModelSchema({
  collection: 'Archive',
  schema: {
    name: String,
    data: Object,
    creatorAuthId: String,
  },
  indexes: [],
});

export const Archive = schema.model();

async function archiveCreate(data, name, creatorAuthId) {
  const $set = { name, data, creatorAuthId };
  const $currentDate = { ts: { $type: 'timestamp' } };
  return Archive.updateOne({ id: data.id, name }, { $set, $currentDate }, { upsert: true });
}

export function delHandler(model) {

  return async ctx => {

    const { path, params: { id }, state: { account } } = ctx;

    ctx.assert(id, 400, 'Need an ID to perform DELETE');

    const { authId: creatorAuthId } = account || {};

    debug('DELETE', path, creatorAuthId);

    const data = await model.findOne({ id });

    ctx.assert(data, 404);

    await archiveCreate(data, model.schema.options.collection, creatorAuthId);
    await data.delete();

    ctx.body = '';
    ctx.status = 204;

  };

}
