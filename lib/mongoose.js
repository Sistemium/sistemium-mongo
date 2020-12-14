import mongoose, { Schema, model } from 'mongoose';
import log from 'sistemium-debug';

export { mongoose, Schema, model };

const { debug } = log('mongoose');

const mongoUrl = process.env.MONGO_URL;

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', true);
  debug('MONGOOSE_DEBUG');
}

mongoose.set('useCreateIndex', true);

export async function connect(url) {
  const urlToConnect = mongodbUrl(url);
  const connected = await mongoose.connect(urlToConnect, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
  });
  debug('connected', urlToConnect);
  return connected;
}

export async function disconnect() {
  debug('disconnected', mongoUrl);
  return mongoose.disconnect();
}

export async function connection(url) {
  const urlToConnect = mongodbUrl(url);
  const options = { useNewUrlParser: true, useCreateIndex: true };
  const connected = await mongoose.createConnection(urlToConnect, options);
  debug('connected', urlToConnect);
  return connected;
}

export function mongodbUrl(url) {
  return `mongodb://${url || mongoUrl}`;
}
