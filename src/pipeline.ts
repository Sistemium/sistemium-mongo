import lowerFirst from 'lodash/lowerFirst';
import type { PipelineStage } from 'mongoose';

type Pipeline = PipelineStage[];
type OrderBy = Record<string, 1 | -1>

export function toOneLookup(from: string, localFieldName?: string, asName?: string): Pipeline {
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

export function toOneOrZeroLookup(from: string, localFieldName?: string, asName?: string): Pipeline {
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

export function top1Lookup(from: string, foreignField: string, orderBy: OrderBy = { ts: -1 }, asName?: string, filter: object = {}, localField: string = 'id'): Pipeline {

  const as = asName || lowerFirst(from);

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


export function toMany(from: string, foreignField: string, as: string = `${from}s`, localField: string = 'id'): Pipeline {
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


export function toManyFiltered(from: string, foreignField?: string, orderBy?: OrderBy, as?: string, filter: object = {}, localField: string = 'id'): Pipeline {

  return [{
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
  }];

}
