import mongo from 'mongodb';

const OFFSET_RE = /^3-(\d{19})$/;

export function offsetToTimestamp(offset) {

  if (offset === '*') {
    return mongo.Timestamp(0, 0);
  }

  try {
    const str = offset.match(OFFSET_RE)[1];
    return mongo.Timestamp.fromString(str);
  } catch (e) {
    throw new Error(`Invalid offset format "${offset}"`)
  }

}

export function timestampToOffset(ts) {
  return `3-${ts.toString()}`;
}
