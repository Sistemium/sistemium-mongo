import lowerFirst from 'lodash/lowerFirst';

export function toOneLookup(from, localFieldName, asName) {
  const as = asName || lowerFirst(from);
  const localField = localFieldName || `${as}Id`;
  return [
    {
      $lookup:
        {
          from,
          localField,
          foreignField: 'id',
          as,
        },
    },
    {
      $unwind: {
        path: `$${as}`,
        preserveNullAndEmptyArrays: false,
      },
    },
  ];
}

export function toOneOrZeroLookup(from, localFieldName, asName) {
  const as = asName || lowerFirst(from);
  const localField = localFieldName || `${as}Id`;
  return [
    {
      $lookup:
        {
          from,
          localField,
          foreignField: 'id',
          as,
        },
    },
    { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },
  ];
}

export function top1Lookup(from, foreignField, orderBy, as, filter = {}, localField = 'id') {

  return [
    {
      $lookup: {
        from,
        let: { [foreignField]: `$${localField}` },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [`$${foreignField}`, `$$${foreignField}`],
              },
              ...filter,
            },
          },
          { $sort: orderBy },
          { $limit: 1 },
        ],
        as,
      },
    },
    { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },
  ];

}


export function toMany(from, foreignField, as = `${from}s`, localField = 'id') {
  return [
    {
      $lookup: {
        from,
        as,
        localField,
        foreignField,
      },
    },
    // { $unwind: `$${as}` },
  ];
}


export function toManyFiltered(from, foreignField, as, filter = {}, localField = 'id') {

  return {
    $lookup: {
      from,
      let: { [foreignField]: `$${localField}` },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: [`$${foreignField}`, `$$${foreignField}`],
            },
            ...filter,
          },
        },
      ],
      as,
    },
  };

}
