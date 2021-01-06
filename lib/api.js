import log from 'sistemium-debug';
import lo from 'lodash';
import qs from 'qs';

import * as predicates from './predicates';
import * as util from './util';
import { delHandler } from './Archive';

const { debug, error } = log('rest');

const PAGE_SIZE_HEADER = 'x-page-size';
export const OFFSET_HEADER = 'x-offset';
const WHERE_KEY = 'where:';

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

    const { path, query: plainQuery } = ctx;
    const query = qs.parse(plainQuery);
    const pageSize = queryOrHeader(ctx, PAGE_SIZE_HEADER) || '10';
    const offset = queryOrHeader(ctx, OFFSET_HEADER);

    const filters = predicates.queryToFilter(query, model.schema);

    const where = query[WHERE_KEY];

    if (where) {
      const jsonWhere = lo.isString(where) ? JSON.parse(where) : where;
      debug('where', jsonWhere);
      Object.assign(filters, predicates.whereToFilter(jsonWhere));
    }

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
    } else if (offset) {
      // required by iSisSales
      ctx.set(OFFSET_HEADER, offset);
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

    const { request: { body }, path, params: { id }, state: { account } } = ctx;

    const isArray = Array.isArray(body);

    ctx.assert(!isArray || !id, 400, 'Can not post array with id');

    const { authId } = account || {};

    const data = isArray ? body : [id ? { ...body, id } : body];

    debug('POST', path, data.length, 'records', authId);

    const $in = await model.merge(data.map(item => model.normalizeItem(item, { authId })));
    const merged = $in.length ? await model.findAll({ id: { $in } }) : [];
    ctx.body = isArray ? merged : lo.first(merged);

  };
}


export function defaultRoutes(router, models = []) {

  models.forEach(model => {

    const { name } = model.collection;

    debug('defaultRoutes for:', name);

    router.post(`/${name}/:id?`, postHandler(model));
    router.put(`/${name}/:id?`, postHandler(model));
    router.get(`/${name}`, getManyHandler(model));
    router.get(`/${name}/:id`, getHandler(model));
    router.delete(`/${name}/:id`, delHandler(model));

  });

}


function queryOrHeader(ctx, headerName) {
  return ctx.query[`${headerName}:`] || ctx.header[headerName];
}
