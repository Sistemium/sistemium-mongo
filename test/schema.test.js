// Runs against the built lib and a disposable database:
// npm run build && MONGO_URL=mongodb://127.0.0.1:27017/sistemium_mongo_test npm test

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('mongodb');
const { ModelSchema } = require('../lib');
const { connect, disconnect } = require('../lib/mongoose');

const { MONGO_URL } = process.env;

describe('ModelSchema ts', { skip: !MONGO_URL && 'MONGO_URL is not set' }, () => {

  const suffix = Date.now();
  let TsModel;
  let DateModel;

  before(async () => {
    await connect();
    TsModel = new ModelSchema({
      collection: `TestTimestamp${suffix}`,
      schema: { name: String, num: Number },
      tsType: 'timestamp',
    }).model();
    DateModel = new ModelSchema({
      collection: `TestDate${suffix}`,
      schema: { name: String },
    }).model();
    await TsModel.merge([{ id: 'a', name: 'A', num: 1 }, { id: 'b', name: 'B', num: 2 }]);
    await DateModel.merge([{ id: 'a', name: 'A' }]);
  });

  after(async () => {
    await TsModel.collection.drop();
    await DateModel.collection.drop();
    await disconnect();
  });

  it('hydrates timestamp ts without cast errors', async () => {
    const docs = await TsModel.find({});
    assert.equal(docs.length, 2);
    docs.forEach(doc => {
      assert.equal(doc.$__.validationError, undefined);
      assert.ok(doc.$isValid('ts'));
      assert.ok(doc.ts instanceof Timestamp);
    });
    const [raw] = await TsModel.collection.find({ id: 'a' }).toArray();
    const doc = docs.find(({ id }) => id === 'a');
    assert.ok(doc.ts.equals(raw.ts));
  });

  it('serializes timestamp ts as the date findAll returns', async () => {
    const doc = await TsModel.findOne({ id: 'a' });
    const [found] = await TsModel.findAll({ id: 'a' });
    const json = doc.toJSON();
    assert.ok(json.ts instanceof Date);
    assert.ok(found.ts instanceof Date);
    assert.equal(json.ts.getTime(), found.ts.getTime());
    assert.equal(json._id, undefined);
  });

  it('queries timestamp ts by Timestamp', async () => {
    const { ts } = await TsModel.findOne({ id: 'a' }).lean();
    const since = new Timestamp({ t: ts.getHighBits() - 1, i: 0 });
    const docs = await TsModel.find({ ts: { $gt: since } });
    assert.equal(docs.length, 2);
  });

  it('saves a hydrated timestamp document', async () => {
    const doc = await TsModel.findOne({ id: 'b' });
    doc.num = 3;
    await doc.save();
    const saved = await TsModel.findOne({ id: 'b' }).lean();
    assert.equal(saved.num, 3);
    assert.ok(saved.ts instanceof Timestamp);
  });

  it('keeps ts as Date for date models', async () => {
    assert.equal(DateModel.schema.path('ts').instance, 'Date');
    const doc = await DateModel.findOne({ id: 'a' });
    assert.equal(doc.$__.validationError, undefined);
    assert.ok(doc.ts instanceof Date);
    assert.ok(doc.toJSON().ts instanceof Date);
  });

  it('mergeIfNotMatched writes only new and changed timestamp rows', async () => {
    const merged = await TsModel.mergeIfNotMatched([
      { id: 'a', name: 'A', num: 1 },
      { id: 'b', name: 'B2', num: 3 },
      { id: 'c', name: 'C' },
    ]);
    assert.deepEqual(merged.map(({ filter }) => filter.id).sort(), ['b', 'c']);
    const repeated = await TsModel.mergeIfNotMatched([{ id: 'b', name: 'B2', num: 3 }]);
    assert.equal(repeated.length, 0);
    const b = await TsModel.findOne({ id: 'b' }).lean();
    assert.equal(b.name, 'B2');
  });

});
