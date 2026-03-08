/**
 * Web Push API rotaları.
 * POST /api/push/subscribe   — Push aboneliği kaydet
 * DELETE /api/push/subscribe — Aboneliği sil
 * GET  /api/push/vapid-key  — VAPID public key döndür
 */
import webpush from 'web-push';
import { knex as db } from '../db/knex.js';
import { authenticate } from '../middleware/authenticate.js';

// VAPID konfigürasyonu — anahtarlar tanımlıysa kur
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@albachat.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function pushRoutes(fastify) {
  /** VAPID public key — auth gerektirmez */
  fastify.get('/vapid-key', async (_req, reply) => {
    return reply.send({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  });

  /** Push aboneliği kaydet */
  fastify.post(
    '/subscribe',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { endpoint, keys } = req.body;
      const userId = req.user.id;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.status(400).send({ error: 'Geçersiz abonelik verisi.' });
      }

      const userAgent = req.headers['user-agent']?.slice(0, 512) || null;

      await db('push_subscriptions')
        .insert({
          user_id: userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent,
        })
        .onConflict('endpoint')
        .merge(['user_id', 'p256dh', 'auth', 'user_agent']);

      return reply.status(201).send({ ok: true });
    },
  );

  /** Push aboneliği sil */
  fastify.delete(
    '/subscribe',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { endpoint } = req.body;
      if (!endpoint) {
        return reply.status(400).send({ error: 'endpoint gerekli.' });
      }

      await db('push_subscriptions')
        .where({ endpoint, user_id: req.user.id })
        .delete();

      return reply.send({ ok: true });
    },
  );

  /** FCM token kaydet (Android/iOS mobil uygulama) */
  fastify.post(
    '/fcm-register',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { token, platform = 'android' } = req.body;
      const userId = req.user.id;

      if (!token) {
        return reply.status(400).send({ error: 'FCM token gerekli.' });
      }

      await db('push_subscriptions')
        .insert({
          user_id: userId,
          fcm_token: token,
          platform,
          // Web Push alanları NULL kalır
          endpoint: `fcm:${token.slice(0, 64)}`, // unique constraint için
          p256dh: '',
          auth: '',
        })
        .onConflict('fcm_token')
        .merge(['user_id', 'platform']);

      return reply.status(201).send({ ok: true });
    },
  );

  /** FCM token sil (çıkış yaparken) */
  fastify.delete(
    '/fcm-register',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { token } = req.body;
      if (!token) {
        return reply.status(400).send({ error: 'FCM token gerekli.' });
      }

      await db('push_subscriptions')
        .where({ fcm_token: token, user_id: req.user.id })
        .delete();

      return reply.send({ ok: true });
    },
  );
}

/**
 * Belirtilen kullanıcı(lar)a Web Push bildirimi gönder.
 * @param {number|number[]} userIds
 * @param {{ title: string, body: string, icon?: string, tag?: string, data?: object }} payload
 */
export async function sendPushToUsers(userIds, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;

  // Sadece Web Push kayıtlarını al (FCM token'lı olanları hariç tut)
  const subscriptions = await db('push_subscriptions')
    .whereIn('user_id', ids)
    .whereNull('fcm_token')
    .whereNot('p256dh', '');

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: payload.tag || 'AlbaChat',
    data: payload.data || {},
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notification,
        )
        .catch(async (err) => {
          // 410 Gone: abonelik artık geçersiz → sil
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db('push_subscriptions').where({ endpoint: sub.endpoint }).delete();
          }
          throw err;
        }),
    ),
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) {
    console.warn(`[Push] ${failed}/${subscriptions.length} bildirim gönderilemedi.`);
  }
}
