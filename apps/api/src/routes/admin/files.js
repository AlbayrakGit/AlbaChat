import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import {
  getStorageStats,
  listFiles,
  bulkSoftDelete,
  restoreFile,
} from '../../services/cleanupService.js';
import { knex } from '../../db/knex.js';

export default async function adminFilesRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/files/stats — depolama istatistikleri
  fastify.get('/stats', async (req, reply) => {
    const stats = await getStorageStats();
    return reply.send({ success: true, data: stats });
  });

  // GET /api/admin/files/list?page=&limit=&groupId=&mimeType=&showDeleted=
  fastify.get('/list', async (req, reply) => {
    const {
      page = '1',
      limit = '50',
      groupId,
      mimeType,
      showDeleted = 'false',
    } = req.query;

    const result = await listFiles({
      page: Math.max(1, parseInt(page, 10)),
      limit: Math.min(100, parseInt(limit, 10)),
      groupId: groupId ? parseInt(groupId, 10) : undefined,
      mimeType,
      showDeleted: showDeleted === 'true',
    });

    return reply.send({
      success: true,
      data: result.files,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: result.total,
      },
    });
  });

  // DELETE /api/admin/files/bulk — toplu soft delete
  // Body: { fileIds?: number[], groupId?: number, mimeType?: string, olderThanDays?: number }
  fastify.delete('/bulk', async (req, reply) => {
    const { fileIds, groupId, mimeType, olderThanDays } = req.body || {};

    if (!fileIds?.length && !groupId && !mimeType && !olderThanDays) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'En az bir filtre belirtilmeli.' },
      });
    }

    const deleted = await bulkSoftDelete({ fileIds, groupId, mimeType, olderThanDays });

    await knex('audit_logs').insert({
      actor_id: req.user.id,
      action: 'files:bulk_delete',
      target_type: 'files',
      target_id: 0,
      detail_json: { fileIds, groupId, mimeType, olderThanDays, deleted },
      ip_address: req.ip,
    });

    return reply.send({ success: true, data: { deleted } });
  });

  // POST /api/admin/files/:id/restore — grace period içinde geri al
  fastify.post('/:id/restore', async (req, reply) => {
    const file = await restoreFile(parseInt(req.params.id, 10));
    if (!file) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Dosya bulunamadı veya grace period doldu.' },
      });
    }
    return reply.send({ success: true, data: { message: 'Dosya geri alındı.' } });
  });
}
