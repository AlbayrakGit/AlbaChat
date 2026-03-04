import { knex } from '../../db/knex.js';
import { setUserOnline, setUserOffline } from '../../utils/redis.js';

/**
 * Bağlantı kurulunca tüm grup odalarına katıl,
 * bağlantı kesilince online durumu güncelle.
 */
export function setupPresenceHandler(io, socket) {
  const user = socket.data.user;

  // ─── Bağlantı kuruldu ────────────────────────────────────────────────────
  (async () => {
    try {
      // Kullanıcının üye olduğu grupları getir
      const memberships = await knex('group_members')
        .where({ user_id: user.id })
        .select('group_id');

      const groupIds = memberships.map((m) => m.group_id);

      // Grup odalarına katıl
      for (const gid of groupIds) {
        socket.join(`group:${gid}`);
      }

      // Socket'e sakla (disconnect'te kullanmak için)
      socket.data.groupIds = groupIds;

      // Redis + DB online durumu
      await setUserOnline(user.id);
      await knex('users').where({ id: user.id }).update({ is_online: true, last_seen: new Date() });

      // Grup üyelerine online bildir
      for (const gid of groupIds) {
        socket.to(`group:${gid}`).emit('user:online', {
          userId: user.id,
          username: user.username,
          isOnline: true,
        });
      }
    } catch (err) {
      console.error('[Presence] connect error:', err.message);
    }
  })();

  // ─── Bağlantı kesildi ───────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      await setUserOffline(user.id);
      await knex('users').where({ id: user.id }).update({ is_online: false, last_seen: new Date() });

      const groupIds = socket.data.groupIds || [];
      for (const gid of groupIds) {
        socket.to(`group:${gid}`).emit('user:online', {
          userId: user.id,
          username: user.username,
          isOnline: false,
        });
      }
    } catch (err) {
      console.error('[Presence] disconnect error:', err.message);
    }
  });

  // ─── Dinamik oda katılımı (üye eklenince) ───────────────────────────────
  socket.on('group:join', async ({ groupId }) => {
    try {
      const membership = await knex('group_members')
        .where({ group_id: groupId, user_id: user.id })
        .first();
      if (membership) {
        socket.join(`group:${groupId}`);
        socket.data.groupIds = [...(socket.data.groupIds || []), groupId];
      }
    } catch (err) {
      console.error('[Presence] group:join error:', err.message);
    }
  });
}
