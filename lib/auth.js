import { roles as getRoles } from 'sistemium-telegram/services/auth';
import log from 'sistemium-telegram/services/log';

const { debug, error } = log('auth');

export default function (config) {

  const { requiredRole } = config;

  return async (ctx, next) => {

    const { header: { authorization }, assert, state } = ctx;

    assert(authorization, 401);

    try {

      const { account, roles } = await getRoles(authorization);

      if (requiredRole) {
        assert(roles[requiredRole], 403);
      }

      debug('authorized:', `"${account.name}"`);

      state.roles = roles;
      state.account = account;

    } catch (e) {
      error('auth:', e.message);
      ctx.throw(401, e);
    }

    await next();

  }

}
