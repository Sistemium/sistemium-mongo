import lo from 'lodash';

enum WhereOperator {
  EQ = '==',
  LT = '<',
  GT = '>',
  GTE = '>=',
  LTE = '<=',
  IN = 'in',
  LIKE = 'like',
}


type WhereClause = Record<WhereOperator, any>

type WhereType = Record<string, WhereClause>

export function whereToFilter(where: WhereType, schema: Record<string, any> = {}) {

  const keys: Record<string, any> = schema ? (schema.tree || schema) : {};

  return lo.mapValues(where, (value, name) => {

    const simpleFilter = getTypedValue(WhereOperator.EQ)

    if (simpleFilter && !lo.isArray(simpleFilter)) {
      return simpleFilter
    }

    const params: Record<string, any> = {
      $gt: getTypedValue(WhereOperator.GT),
      $lt: getTypedValue(WhereOperator.LT),
      $gte: getTypedValue(WhereOperator.GTE),
      $lte: getTypedValue(WhereOperator.LTE),
      $in: lo.get(value, WhereOperator.IN) || simpleFilter,
    }

    const { [WhereOperator.LIKE]: like } = value;

    if (like) {
      const pattern = lo.escapeRegExp(like)
        .replace(/%/g, '.*')
      // .replace(/\\(?=\[|])/g, ''), 'i')
      params.$regex = new RegExp(pattern)
    }

    return lo.pickBy(params, v => v !== undefined);

    function getTypedValue(path: WhereOperator) {
      const key = keys[name];
      const raw = lo.get(value, path);
      try {
        return (raw && key === Date) ? new Date(raw) : raw;
      } catch (e) {
        return raw;
      }
    }

  });

}

export function queryToFilter(query?: Record<string, any>, schema: Record<string, any> = {}): Record<string, any> {
  const tree: Record<string, any> = schema.tree || schema || {};
  const queryKeys = Object.keys(query || {})
    .filter(name => {
      const [field] = name.match(/^[^.]+/) || [];
      return field && tree[field];
    });
  return lo.mapValues(lo.pick(query, queryKeys), x => {
    if (Array.isArray(x)) {
      return { $in: x };
    }
    return x || null;
  });
}
