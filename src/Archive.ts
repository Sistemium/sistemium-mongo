import log from 'sistemium-debug';
import { Context } from 'koa';

import ModelSchema, { BaseItem, MongoModel } from './schema';

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

async function archiveCreate(data: BaseItem, name: string, creatorAuthId?: string) {
  const $set = { name, data, creatorAuthId };
  const $currentDate = { ts: { $type: 'timestamp' } };
  return Archive.updateOne({ id: data.id, name }, { $set, $currentDate }, { upsert: true });
}

export function delHandler(model: MongoModel) {

  return async (ctx: Context) => {

    const { path, params: { id }, state: { account } } = ctx;

    ctx.assert(id, 400, 'Need an ID to perform DELETE');

    const { authId: creatorAuthId } = account || {};

    debug('DELETE', path, creatorAuthId);

    const data = await model.findOne({ id });

    ctx.assert(data, 404);

    await archiveCreate(data, model.collection.name || model.collection as undefined, creatorAuthId);
    await model.deleteOne({ id });

    ctx.body = '';
    ctx.status = 204;

  };

}
