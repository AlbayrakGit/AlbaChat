import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import {
  createAnnouncement,
  getPendingAnnouncements,
  getAnnouncementList,
  getAnnouncementById,
  markAsRead,
  getAnnouncementStats,
  deleteAnnouncement,
  AnnouncementNotFoundError,
  AnnouncementForbiddenError,
} from '../services/announcementService.js';
import { io } from '../server.js';
import { sendPushToUsers } from './push.js';
import { sendFcmToUsers } from '../utils/fcm.js';
import { knex as db } from '../db/knex.js';

function handleError(err, reply) {
  if (err instanceof AnnouncementNotFoundError)
    return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof AnnouncementForbiddenError)
    return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
  throw err;
}

export default async function announcementRoutes(fastify) {
  // POST /api/announcements — duyuru oluştur (Admin)
  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { title, content, scope, priority, groupIds, expiresAt } = req.body;
    if (!title || !content) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'Başlık ve içerik zorunlu.' },
      });
    }

    try {
      const announcement = await createAnnouncement({
        title, content,
        scope: scope || 'global',
        priority: priority || 'normal',
        groupIds: groupIds || [],
        expiresAt: expiresAt || null,
        createdBy: req.user.id,
      });

      // Bağlı kullanıcılara yayınla
      if (announcement.scope === 'global') {
        io.emit('announcement:new', announcement);
      } else {
        // Grup bazlı: sadece ilgili odaları hedefle
        for (const g of announcement.groups) {
          io.to(`group:${g.id}`).emit('announcement:new', announcement);
        }
      }

      // Web Push — çevrimdışı kullanıcılara bildirim gönder
      try {
        let targetUserIds;
        if (announcement.scope === 'global') {
          const rows = await db('users').where({ is_active: true }).select('id');
          targetUserIds = rows.map((r) => r.id);
        } else {
          const groupIds = announcement.groups.map((g) => g.id);
          const rows = await db('group_members')
            .whereIn('group_id', groupIds)
            .distinct('user_id')
            .select('user_id');
          targetUserIds = rows.map((r) => r.user_id);
        }
        const pushPayload = {
          title: `📢 ${announcement.title}`,
          body: announcement.content.slice(0, 120),
          tag: `announcement-${announcement.id}`,
          data: { type: 'announcement', id: String(announcement.id) },
        };
        await Promise.allSettled([
          sendPushToUsers(targetUserIds, pushPayload),
          sendFcmToUsers(targetUserIds, pushPayload),
        ]);
      } catch (_e) {
        // Push hatası ana isteği engellemesin
      }

      return reply.code(201).send({ success: true, data: announcement });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // GET /api/announcements/pending — okunmamış duyurular
  fastify.get('/pending', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const announcements = await getPendingAnnouncements(req.user.id);
      return reply.send({ success: true, data: announcements });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // GET /api/announcements — arşiv listesi
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    try {
      const result = await getAnnouncementList({ page, limit });
      return reply.send({ success: true, data: result });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // GET /api/announcements/:id — detay
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const announcement = await getAnnouncementById(parseInt(req.params.id, 10));
      return reply.send({ success: true, data: announcement });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // POST /api/announcements/:id/read — okundu işaretle
  fastify.post('/:id/read', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const result = await markAsRead(parseInt(req.params.id, 10), req.user.id);
      return reply.send({ success: true, data: result });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // GET /api/announcements/:id/stats — okuma istatistikleri (Admin)
  fastify.get('/:id/stats', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    try {
      const stats = await getAnnouncementStats(parseInt(req.params.id, 10));
      return reply.send({ success: true, data: stats });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // POST /api/announcements/:id/notify — okumayan kullanıcılara tekrar gönder (Admin)
  fastify.post('/:id/notify', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    try {
      const stats = await getAnnouncementStats(parseInt(req.params.id, 10));
      const announcement = await getAnnouncementById(parseInt(req.params.id, 10));

      // Okumayan online kullanıcıların socket'lerine gönder
      let notified = 0;
      for (const u of stats.unreadUsers) {
        const sockets = await io.fetchSockets();
        for (const s of sockets) {
          if (s.data?.user?.id === u.id) {
            s.emit('announcement:new', announcement);
            notified++;
          }
        }
      }

      return reply.send({
        success: true,
        data: { notified, unreadCount: stats.unreadCount },
      });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // DELETE /api/announcements/:id — duyuru sil (Admin)
  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    try {
      const result = await deleteAnnouncement(parseInt(req.params.id, 10));
      return reply.send({ success: true, data: result });
    } catch (err) {
      return handleError(err, reply);
    }
  });
}
