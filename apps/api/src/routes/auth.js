import {
  login,
  refresh,
  logout,
  changePassword,
  AuthError,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from '../services/authService.js';
import { authenticate } from '../middleware/authenticate.js';

const loginRateLimitOpts = {
  config: {
    rateLimit: { max: 5, timeWindow: '1 minute' },
  },
};

export default async function authRoutes(fastify) {
  /**
   * POST /api/auth/login
   * Body: { username, password }
   * Yanıt: { success, data: { access_token, user } }
   * Cookie: kc_refresh (httpOnly)
   */
  fastify.post('/login', { ...loginRateLimitOpts }, async (req, reply) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Kullanıcı adı ve şifre gerekli.' },
      });
    }

    try {
      const result = await login(username.trim(), password);

      reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);

      return reply.code(200).send({
        success: true,
        data: {
          access_token: result.accessToken,
          user: result.user,
        },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' },
      });
    }
  });

  /**
   * POST /api/auth/refresh
   * Cookie: kc_refresh gerekli
   * Yanıt: { success, data: { access_token } }
   */
  fastify.post('/refresh', async (req, reply) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return reply.code(401).send({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'Oturum bulunamadı.' },
      });
    }

    try {
      const result = await refresh(refreshToken);
      return reply.code(200).send({
        success: true,
        data: { access_token: result.accessToken },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
        return reply.code(401).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' },
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Cookie: kc_refresh (opsiyonel — yoksa sadece cookie temizlenir)
   * Yanıt: { success, data: { message } }
   */
  fastify.post('/logout', { preHandler: [authenticate] }, async (req, reply) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await logout(refreshToken);
    }

    reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    return reply.code(200).send({
      success: true,
      data: { message: 'Başarıyla çıkış yapıldı.' },
    });
  });

  /**
   * GET /api/auth/me
   * Authorization: Bearer <token> gerekli
   * Yanıt: { success, data: { user } }
   */
  fastify.get('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const { knex } = await import('../db/knex.js');
    const user = await knex('users')
      .where({ id: req.user.id })
      .first('id', 'username', 'email', 'display_name', 'avatar_url', 'role', 'is_online', 'last_seen', 'timezone');

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' },
      });
    }

    return reply.code(200).send({ success: true, data: { user } });
  });

  /**
   * POST /api/auth/change-password
   * Body: { currentPassword, newPassword }
   */
  fastify.post('/change-password', { preHandler: [authenticate] }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Mevcut ve yeni şifre gerekli.' },
      });
    }
    if (newPassword.length < 4) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Yeni şifre en az 4 karakter olmalıdır.' },
      });
    }
    try {
      await changePassword(req.user.id, currentPassword, newPassword);
      return reply.code(200).send({ success: true, data: { message: 'Şifre başarıyla değiştirildi.' } });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(401).send({ success: false, error: { code: err.code, message: err.message } });
      }
      fastify.log.error(err);
      return reply.code(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası.' } });
    }
  });
}
