import log from 'sistemium-telegram/services/log';
import lo from 'lodash';
import mapValues from 'lodash/mapValues';

const { debug, error } = log('rest');

const PAGE_SIZE_HEADER = 'x-page-size';

export function getHandler(model) {

  return async ctx => {

    const { params: { id }, path } = ctx;

    debug('GET', path, id);

    try {

      ctx.body = lo.first(await findAll(model, { id }, 1));

    } catch (err) {
      error(err.name, err.message);
      ctx.throw(500);
    }

  };
}

export function getManyHandler(model) {
  return async ctx => {

    const { header: { [PAGE_SIZE_HEADER]: pageSize = '10' }, path, query } = ctx;
    const filters = mapValues(lo.pick(query, Object.keys(model.schema.tree)), x => x || null);

    debug('GET', path, filters);

    try {
      ctx.body = await findAll(model, filters, parseInt(pageSize, 0));
    } catch (err) {
      error(err.name, err.message);
      ctx.throw(500);
    }

  };
}

function postHandler(model) {
  return async ctx => {

    const { request: { body }, path, params: { id } } = ctx;

    const isArray = Array.isArray(body);

    ctx.assert(!isArray || !id, 400, 'Can not post array with id');

    const data = isArray ? body : [id ? { ...body, id } : body];

    debug('POST', path, data.length, 'records');

    const merged = await model.merge(data);
    ctx.body = isArray ? merged : lo.first(merged);

  };
}


export function defaultRoutes(router, models = []) {

  models.forEach(model => {

    const { name } = model.collection;

    debug('defaultRoutes for:', name);

    router.post(`/${name}`, postHandler(model));
    router.get(`/${name}`, getManyHandler(model));
    router.get(`/${name}/:id`, getHandler(model));

  });

}

function findAll(model, filters, pageSize = 10) {

  const pipeline = [];

  if (Object.keys(filters).length) {
    pipeline.push({ $match: filters });
  }

  debug(lo.mapValues(model.schema.tree, true));

  const $project = {
    ...lo.mapValues(model.schema.tree, () => true),
    _id: false,
  };

  if (model.schema.get('tsType') === 'timestamp') {
    $project.ts = { $toDate: { $dateToString: { date: '$ts' } } };
  }

  pipeline.push({ $project });

  return model.aggregate(pipeline)
    .limit(pageSize);

}
