import lo from 'lodash';

export function whereToFilter(where) {

  return lo.mapValues(where, value => {

    const simpleFilter = lo.get(value, '==');

    if (simpleFilter && !lo.isArray(simpleFilter)) return simpleFilter;

    const params = {
      $gte: lo.get(value, '>='),
      $lte: lo.get(value, '<='),
      $in: lo.get(value, 'in') || simpleFilter,
    };

    const { like } = value;

    if (like) {
      params.$regex = new RegExp(lo.escapeRegExp(like)
        .replace(/%/g, '.*')
        .replace(/\\(?=\[|])/g, ''), 'i');
    }

    return lo.pickBy(params, v => v !== undefined);

  });

}

export function queryToFilter(query, schema) {
  return lo.mapValues(lo.pick(query, Object.keys(schema.tree)), x => x || null);
}
