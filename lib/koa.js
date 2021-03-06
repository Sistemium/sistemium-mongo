import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import log from 'sistemium-debug';
import morgan from 'koa-morgan';
import cors from '@koa/cors';
import * as mongo from './mongoose';

const { debug, error } = log('rest');
const { REST_PORT } = process.env;

export default class KoaApi {

  constructor(props) {

    this.app = new Koa();

    const { api, port = REST_PORT } = props;

    const corsOptions = { origin: '*' };

    mongo.connect()
      .then(mongoose => {
        const { connection: { db: { databaseName } } } = mongoose;
        debug('mongo connected:', databaseName);
      })
      .catch(e => error('mongo connect error', e.message));

    this.app
      .use(cors(corsOptions))
      .use(morgan(':status :method :url :res[content-length] - :response-time ms'))
      // .use(auth)
      .use(bodyParser())
      .use(api.routes())
      .use(api.allowedMethods());

    if (port) {
      debug('starting on port', port);
      this.app.listen(port);
    }

    process.on('SIGINT', () => {
      cleanup().then(debug, error);
    });

  }


}

async function cleanup() {

  error('cleanup');

  await mongo.disconnect()
    .catch(error);

  process.exit();

}
