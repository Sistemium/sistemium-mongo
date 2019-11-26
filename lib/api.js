import log from 'sistemium-telegram/services/log';
import lo from 'lodash';
import mapValues from 'lodash/mapValues';

import * as util from './util';
import { delHandler } from './Archive';

const { debug, error } = log('rest');

const PAGE_SIZE_HEADER = 'x-page-size';
const OFFSET_HEADER = 'x-offset';

export function getHandler(model) {

  return async ctx => {

    const { params: { id }, path } = ctx;

    debug('GET', path, id);

    const result = lo.first(await model.findAll({ id }, 1));

    ctx.assert(result, 404);

    delete result[OFFSET_HEADER];

    ctx.body = result;

  };
}

export function getManyHandler(model) {
  return async ctx => {

    const { header, path, query } = ctx;
    const {
      [PAGE_SIZE_HEADER]: pageSize = '10',
      [OFFSET_HEADER]: offset,
    } = header;

    const filters = mapValues(lo.pick(query, Object.keys(model.schema.tree)), x => x || null);

    if (offset && offset !== '*') {
      try {
        filters.ts = { $gt: util.offsetToTimestamp(offset) };
      } catch (e) {
        ctx.throw(400, e);
      }
    }

    debug('GET', path, filters);

    const data = await model.findAll(filters, parseInt(pageSize, 0));

    if (offset && data.length) {
      const lastTs = lo.last(data)[OFFSET_HEADER];
      const newOffset = util.timestampToOffset(lastTs);
      debug('offsets:', offset, newOffset);
      ctx.set(OFFSET_HEADER, newOffset);
      lo.forEach(data, item => delete item[OFFSET_HEADER]);
    }

    if (!data.length) {
      ctx.status = 204;
    } else {
      ctx.body = data;
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
    router.delete(`/${name}/:id`, delHandler(model));

  });

}
