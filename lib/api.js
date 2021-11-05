import log from 'sistemium-debug';
import lo from 'lodash';
import qs from 'qs';
import mapSeries from 'async/mapSeries';

import * as predicates from './predicates';
import * as util from './util';
import { delHandler } from './Archive';

const { debug, error } = log('rest');

const PAGE_SIZE_HEADER = 'x-page-size';
export const OFFSET_HEADER = 'x-offset';
export const PATCH_HEADER = 'x-patch';
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
      Object.assign(filters, predicates.whereToFilter(jsonWhere, model.schema));
    }

    if (offset && offset !== '*') {
      try {
        filters.ts = { $gt: util.offsetToTimestamp(offset) };
      } catch (e) {
        ctx.throw(400, e);
      }
    }

    const { rolesFilter } = model;
    const allFilters = lo.filter([
      rolesFilter && rolesFilter(ctx.state),
      filters,
      // ...(ctx.state.filters || []),
    ]);

    debug('GET', path, allFilters);

    const data = await model.findAll(allFilters, parseInt(pageSize, 0));

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

export function postHandler(model) {
  return async ctx => {

    const { request: { body }, path, params: { id }, state: { account } } = ctx;
    const { [PATCH_HEADER]: patch = false } = ctx.headers;
    const options = { patch };
    const isArray = Array.isArray(body);

    ctx.assert(!isArray || !id, 400, 'Can not post array with id');

    const { authId: creatorAuthId } = account || {}
    const data = isArray ? body : [id ? { ...body, id } : body];
    const normalized = data.map(item => model.normalizeItem(item, {}, { creatorAuthId }));

    debug('POST', path, data.length, 'records', creatorAuthId, options);

    const $in = await model.merge(normalized, options);
    const merged = await findMerged();

    ctx.body = isArray ? merged : lo.first(merged);

    async function findMerged() {
      if (mergeById(model)) {
        return $in.length ? model.findAll({ id: { $in } }) : [];
      } else {
        return mapSeries(data, async item => {
          const keys = lo.pick(item, model.mergeBy);
          const [res] = await model.findAll(keys);
          return res;
        });
      }
    }

  };

}


export function patchHandler(model) {

  return async ctx => {

    const { params: { id }, path, request: { body } } = ctx;

    ctx.assert(lo.isObject(body), 410, 'PATCH body must be object');

    debug('PATCH', path, id, body);

    const item = await model.findOne({ id });

    ctx.assert(item, 404);

    const props = {
      ...body,
      id,
      ...lo.pick(item, model.mergeBy),
    };

    await model.merge([props], { patch: true });

    [ctx.body] = await model.findAll({ id });

  };
}


export function defaultRoutes(router, models = []) {

  models.forEach(model => {

    const { name = model.collection } = model.collection;

    debug('defaultRoutes for:', name);

    router.post(`/${name}/:id?`, postHandler(model));
    router.put(`/${name}/:id?`, postHandler(model));
    router.get(`/${name}`, getManyHandler(model));
    router.get(`/${name}/:id`, getHandler(model));
    router.delete(`/${name}/:id`, delHandler(model));
    router.patch(`/${name}/:id`, patchHandler(model));

  });

}


function queryOrHeader(ctx, headerName) {
  return ctx.query[`${headerName}:`] || ctx.header[headerName];
}

function mergeById(model) {
  const { mergeBy } = model;
  return !mergeBy
    || (mergeBy.length === 1 && mergeBy[0] === 'id');
}
