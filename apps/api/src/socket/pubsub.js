import { redis } from '../utils/redis.js';

/**
 * Redis Pub/Sub — çok-instance Socket.IO yayını
 *
 * Her sunucu instance'ı aynı Redis kanalına abone olur.
 * Bir instance mesaj gönderince diğerleri de kendi odalarındaki
 * istemcilere yayınlar. Tek-instance kurulumda da çalışır.
 */

const CHANNEL = 'albachat:socket:events';

// Ayrı pub/sub bağlantıları (aynı redis instance kullanılamaz)
export const pubClient = redis.duplicate();
export const subClient = redis.duplicate();

pubClient.on('error', (e) => console.error('[PubSub:pub]', e.message));
subClient.on('error', (e) => console.error('[PubSub:sub]', e.message));

// ─── Yayın yardımcıları ───────────────────────────────────────────────────

export async function publishMessageNew(groupId, message) {
  await pubClient.publish(CHANNEL, JSON.stringify({ type: 'message:new', groupId, message }));
}

export async function publishMessageDeleted(groupId, messageId) {
  await pubClient.publish(CHANNEL, JSON.stringify({ type: 'message:deleted', groupId, messageId }));
}

export async function publishMessageReacted(groupId, messageId, reactions) {
  await pubClient.publish(CHANNEL, JSON.stringify({ type: 'message:reacted', groupId, messageId, reactions }));
}

export async function publishMessageRead(groupId, userId, username, lastMessageId) {
  await pubClient.publish(
    CHANNEL,
    JSON.stringify({ type: 'message:read', groupId, userId, username, lastMessageId }),
  );
}

// ─── Abone ol — gelen eventleri socket odalarına yayınla ─────────────────

export function subscribeToEvents(io) {
  subClient.subscribe(CHANNEL, (err) => {
    if (err) console.error('[PubSub] Abone olunamadı:', err.message);
    else console.log('[PubSub] Redis kanalına abone olundu');
  });

  subClient.on('message', (channel, raw) => {
    if (channel !== CHANNEL) return;
    try {
      const payload = JSON.parse(raw);

      if (payload.type === 'message:new') {
        io.to(`group:${payload.groupId}`).emit('message:new', payload.message);
      } else if (payload.type === 'message:deleted') {
        io.to(`group:${payload.groupId}`).emit('message:deleted', {
          messageId: payload.messageId,
          groupId: payload.groupId,
        });
      } else if (payload.type === 'message:read') {
        io.to(`group:${payload.groupId}`).emit('message:read', {
          groupId: payload.groupId,
          userId: payload.userId,
          username: payload.username,
          lastMessageId: payload.lastMessageId,
        });
      } else if (payload.type === 'message:reacted') {
        io.to(`group:${payload.groupId}`).emit('message:reacted', {
          groupId: payload.groupId,
          messageId: payload.messageId,
          reactions: payload.reactions,
        });
      }
    } catch (err) {
      console.error('[PubSub] Parse hatası:', err.message);
    }
  });
}
