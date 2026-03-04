import { getMessagesSince } from '../../services/messageService.js';

/**
 * Bağlantı yeniden kurulunca kaçırılan mesajları gönder.
 *
 * Client  → server : connect:catchup  { groups: [{groupId, lastMessageId}] }
 * Server  → client : connect:catchup:response  { groups: [{groupId, messages}] }
 */
export function setupCatchupHandler(io, socket) {
  const user = socket.data.user;

  socket.on('connect:catchup', async (data) => {
    try {
      const groups = Array.isArray(data?.groups) ? data.groups : [];
      if (groups.length === 0) return;

      const results = [];

      for (const { groupId, lastMessageId } of groups) {
        try {
          const messages = await getMessagesSince(groupId, user.id, lastMessageId ?? 0);
          if (messages.length > 0) {
            results.push({ groupId, messages });
          }
        } catch {
          // Kullanıcı gruptan çıkarılmış olabilir — atla
        }
      }

      if (results.length > 0) {
        socket.emit('connect:catchup:response', { groups: results });
        console.log(`[Catchup] ${user.username} → ${results.reduce((n, g) => n + g.messages.length, 0)} kaçırılmış mesaj gönderildi`);
      }
    } catch (err) {
      console.error('[Catchup] Hata:', err.message);
    }
  });
}
