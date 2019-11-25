import mongoose from 'mongoose';
import log from 'sistemium-telegram/services/log';

const { debug } = log('mongoose');

const mongoUrl = process.env.MONGO_URL;

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', true);
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

export function connection(url) {
  const options = { useNewUrlParser: true, useCreateIndex: true };
  return mongoose.createConnection(mongodbUrl(url), options);
}

export function mongodbUrl(url) {
  return `mongodb://${url || mongoUrl}`;
}
