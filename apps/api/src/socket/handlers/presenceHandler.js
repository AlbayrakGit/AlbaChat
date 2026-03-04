import { knex } from '../../db/knex.js';
import { setUserOnline, setUserOffline } from '../../utils/redis.js';

/**
 * Kullanıcının DM geçmişi olan kişiler için kişisel socket odasına katıl.
 * Format: user:{userId}
 * Bu sayede DM arkadaşlarına da anlık online/offline bildirimi gidebilir.
 */
async function broadcastPresence(io, socket, userId, username, isOnline) {
  try {
    const groupIds = socket.data.groupIds || [];

    // 1. Grup üyelerine bildir
    for (const gid of groupIds) {
      socket.to(`group:${gid}`).emit('user:online', {
        userId,
        username,
        isOnline,
      });
    }

    // 2. DM geçmişi olan kişilere de bildir (user:{id} odası üzerinden)
    const dmPartnerRows = await knex('groups')
      .join('group_members as gm1', 'groups.id', 'gm1.group_id')
      .join('group_members as gm2', 'groups.id', 'gm2.group_id')
      .where('groups.type', 'direct')
      .where('gm1.user_id', userId)
      .whereNot('gm2.user_id', userId)
      .select('gm2.user_id as partner_id')
      .distinct();

    for (const row of dmPartnerRows) {
      io.to(`user:${row.partner_id}`).emit('user:online', {
        userId,
        username,
        isOnline,
      });
    }
  } catch (err) {
    console.error('[Presence] broadcastPresence error:', err.message);
  }
}

/**
 * Bağlantı kurulunca tüm grup odalarına katıl,
 * bağlantı kesilince online durumu güncelle.
 */
export function setupPresenceHandler(io, socket) {
  const user = socket.data.user;

  // ─── Kullanıcının kişisel odasına katıl (DM bildirimleri için) ──────────
  socket.join(`user:${user.id}`);

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

      // Tüm ilgili kişilere online bildir
      await broadcastPresence(io, socket, user.id, user.username, true);
    } catch (err) {
      console.error('[Presence] connect error:', err.message);
    }
  })();

  // ─── Bağlantı kesildi ───────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      await setUserOffline(user.id);
      await knex('users').where({ id: user.id }).update({ is_online: false, last_seen: new Date() });

      // Tüm ilgili kişilere offline bildir
      await broadcastPresence(io, socket, user.id, user.username, false);
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

  // ─── Heartbeat ping — client'tan düzenli ping gelirse last_seen güncelle ─
  socket.on('presence:ping', async () => {
    try {
      await setUserOnline(user.id);
      await knex('users').where({ id: user.id }).update({ last_seen: new Date() });
      socket.emit('presence:pong');
    } catch (err) {
      console.error('[Presence] heartbeat error:', err.message);
    }
  });
}
