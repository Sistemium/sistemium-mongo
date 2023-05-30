import mongoose, { Schema, model } from 'mongoose';
import log from 'sistemium-debug';

export { mongoose, Schema, model };

const { debug } = log('mongoose');

const mongoUrl = process.env.MONGO_URL;

const MONGO_OPTIONS = {
  // useNewUrlParser: true,
  // useCreateIndex: true,
  // useUnifiedTopology: true,
};

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', true);
  debug('MONGOOSE_DEBUG');
}

// mongoose.set('useCreateIndex', true);
// mongoose.set('useFindAndModify', false);

export async function connect(url) {
  const urlToConnect = mongodbUrl(url);
  const connected = await mongoose.connect(urlToConnect, MONGO_OPTIONS);
  debug('connected', urlToConnect);
  return connected;
}

export async function disconnect() {
  const {
    host,
    port,
    db = {},
  } = mongoose.connection;
  debug('disconnected', `mongodb://${host}:${port}/${db.databaseName}`);
  return mongoose.disconnect();
}

export async function connection(url) {
  const urlToConnect = mongodbUrl(url);
  const connected = await mongoose.createConnection(urlToConnect, MONGO_OPTIONS)
    .asPromise();
  debug('connected', urlToConnect);
  return connected;
}

export function mongodbUrl(url) {
  const cs = url || mongoUrl || '';
  const hasSchema = !!cs.match(/:\/\//);
  return `${hasSchema ? '' : 'mongodb://'}${url || mongoUrl}`;
}
