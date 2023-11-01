import lo from 'lodash';

export function whereToFilter(where, schema) {

  const keys = schema ? (schema.tree || schema) : {};

  return lo.mapValues(where, (value, name) => {

    const simpleFilter = getTypedValue('==');

    if (simpleFilter && !lo.isArray(simpleFilter)) return simpleFilter;

    const params = {
      $gt: getTypedValue('>'),
      $lt: getTypedValue('<'),
      $gte: getTypedValue('>='),
      $lte: getTypedValue('<='),
      $in: lo.get(value, 'in') || simpleFilter,
    };

    const { like } = value;

    if (like) {
      params.$regex = new RegExp(lo.escapeRegExp(like)
        .replace(/%/g, '.*')
        .replace(/\\(?=\[|])/g, ''), 'i');
    }

    return lo.pickBy(params, v => v !== undefined);

    function getTypedValue(path) {
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

export function queryToFilter(query, schema) {
  const tree = schema.tree || schema || {};
  const queryKeys = Object.keys(query || {})
    .filter(name => {
      const [field] = name.match(/^[^.]+/);
      return !!tree[field];
    });
  return lo.mapValues(lo.pick(query, queryKeys), x => {
    if (Array.isArray(x)) {
      return { $in: x };
    }
    return x || null;
  });
}
