import { knex } from '../../db/knex.js';
import { publishMessageRead } from '../pubsub.js';

/**
 * message:read:ack — kullanıcı mesajları okudu
 * { groupId, lastMessageId } payload'ı alır.
 * lastMessageId'ye kadar kendi göndermediği tüm mesajları okundu işaretler.
 * Ardından gruptaki diğer kullanıcılara message:read yayınlar.
 */
export function setupReadHandler(io, socket) {
  const user = socket.data.user;

  socket.on('message:read:ack', async ({ groupId, lastMessageId }) => {
    if (!groupId || !lastMessageId) return;

    try {
      // Üyelik kontrolü
      const member = await knex('group_members')
        .where({ group_id: groupId, user_id: user.id })
        .first();
      if (!member) return;

      // Kendi göndermediği, henüz okunmamış mesajları bul
      const unread = await knex('messages')
        .where('group_id', groupId)
        .where('id', '<=', lastMessageId)
        .where('sender_id', '!=', user.id)
        .where('is_deleted', false)
        .whereNotExists(
          knex('message_reads')
            .where('user_id', user.id)
            .whereRaw('message_reads.message_id = messages.id'),
        )
        .select('id');

      if (unread.length === 0) return;

      await knex('message_reads').insert(
        unread.map((m) => ({
          message_id: m.id,
          user_id: user.id,
          read_at: new Date(),
        })),
      );

      // Gruba okundu bildir (sadece mesaj sahiplerine ulaşsın — room broadcast)
      await publishMessageRead(groupId, user.id, user.username, lastMessageId);
    } catch (err) {
      console.error('[ReadHandler] message:read:ack error:', err.message);
    }
  });
}
