/**
 * Firebase Cloud Messaging (FCM) — Android push bildirimleri
 *
 * Ortam değişkenleri:
 *   GOOGLE_APPLICATION_CREDENTIALS — service account JSON dosya yolu
 *   veya
 *   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY — inline credentials
 */
import admin from 'firebase-admin';
import { knex as db } from '../db/knex.js';

let fcmEnabled = false;

// Firebase Admin'i başlat
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Dosya yolundan oku
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    fcmEnabled = true;
    console.log('[FCM] Firebase Admin başlatıldı (credentials dosyasından)');
  } else if (process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY) {
    // Ortam değişkenlerinden inline
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        // Docker/env'de \n kaçış karakteri düzeltmesi
        privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    fcmEnabled = true;
    console.log('[FCM] Firebase Admin başlatıldı (ortam değişkenlerinden)');
  } else {
    console.warn('[FCM] Firebase yapılandırması bulunamadı — FCM devre dışı');
  }
} catch (err) {
  console.error('[FCM] Firebase Admin başlatma hatası:', err.message);
}

/**
 * Belirtilen kullanıcılara FCM push bildirimi gönder.
 * @param {number|number[]} userIds
 * @param {{ title: string, body: string, data?: object }} payload
 */
export async function sendFcmToUsers(userIds, payload) {
  if (!fcmEnabled) return;

  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return;

  // FCM token'ları olan kayıtları al
  const tokens = await db('push_subscriptions')
    .whereIn('user_id', ids)
    .whereNotNull('fcm_token')
    .select('fcm_token', 'id');

  if (tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    token: t.fcm_token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: {
        channelId: 'albachat_messages',
        icon: 'ic_launcher',
        color: '#1e3a5f',
      },
    },
  }));

  const result = await admin.messaging().sendEach(messages);

  // Başarısız token'ları temizle (unregistered, invalid)
  const invalidIds = [];
  result.responses.forEach((resp, i) => {
    if (
      !resp.success &&
      resp.error &&
      (resp.error.code === 'messaging/registration-token-not-registered' ||
        resp.error.code === 'messaging/invalid-registration-token')
    ) {
      invalidIds.push(tokens[i].id);
    }
  });

  if (invalidIds.length > 0) {
    await db('push_subscriptions').whereIn('id', invalidIds).delete();
    console.log(`[FCM] ${invalidIds.length} geçersiz token silindi`);
  }

  const failed = result.responses.filter((r) => !r.success).length;
  if (failed > 0) {
    console.warn(`[FCM] ${failed}/${tokens.length} bildirim gönderilemedi`);
  }
}

export { fcmEnabled };
