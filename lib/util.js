import * as mongo from 'mongodb';

export default mongo;

const OFFSET_RE = /^2-(\d{19})$/;
const OFFSET_OLD = /^1-(\d{17})-(\d+)$/;

const OFFSET_ZERO = new mongo.Timestamp({ t: 0, i: 0 });

export function offsetToTimestamp(offset) {

  if (offset === '*') {
    return OFFSET_ZERO;
  }

  const str = offset.match(OFFSET_RE);

  if (!str && OFFSET_OLD.test(offset)) {
    return OFFSET_ZERO;
  }

  if (!str) {
    throw new Error(`Invalid offset format "${offset}"`);
  }

  return mongo.Timestamp.fromString(str[1], 10);

}

export function timestampToOffset(ts) {
  const offset = `2-${ts.toString()}`;
  if (!OFFSET_RE.test(offset)) {
    throw new Error(`Invalid timestamp "${ts}"`);
  }
  return offset;
}
