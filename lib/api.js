import log from 'sistemium-telegram/services/log';
import pick from 'lodash/pick';
import mapValues from 'lodash/mapValues';

const { debug, error } = log('rest');

const PAGE_SIZE_HEADER = 'x-page-size';

export function getHandler(model) {

  return async ctx => {

    const { params: { id }, path } = ctx;

    debug('GET', path, id);

    try {

      ctx.body = await model.findOne({ id });

    } catch (err) {
      error(err.name, err.message);
      ctx.throw(500);
    }

  };
}

export function getManyHandler(model) {
  return async ctx => {

    const { header: { [PAGE_SIZE_HEADER]: pageSize = '10' }, path, query } = ctx;
    const filters = mapValues(pick(query, Object.keys(model.schema.tree)), x => x || null);

    debug('GET', path, filters);

    try {

      ctx.body = await model.find(filters).limit(parseInt(pageSize, 0));

    } catch (err) {
      error(err.name, err.message);
      ctx.throw(500);
    }

  };
}

function postHandler(model) {
  return async ctx => {

    const { request: { body }, path } = ctx;

    ctx.assert(Array.isArray(body), 400, 'Body must be an array');

    debug('POST', path, body.length, 'bytes');

    try {

      ctx.body = await model.merge(body);

    } catch (e) {
      const { writeErrors } = e;
      if (writeErrors && writeErrors.length) {
        error('writeErrors[0]:', JSON.stringify(writeErrors[0]));
      }
      ctx.throw(500, e);
    }

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
