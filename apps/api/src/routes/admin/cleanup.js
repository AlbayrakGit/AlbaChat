import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { runPolicy } from '../../services/cleanupService.js';
import { knex } from '../../db/knex.js';

export default async function adminCleanupRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/cleanup-policies
  fastify.get('/', async (req, reply) => {
    const policies = await knex('file_cleanup_policies as p')
      .leftJoin('groups as g', 'g.id', 'p.group_id')
      .leftJoin('users as u', 'u.id', 'p.created_by')
      .select(
        'p.*',
        'g.name as group_name',
        'u.display_name as creator_name',
      )
      .orderBy('p.created_at', 'desc');

    return reply.send({ success: true, data: policies });
  });

  // POST /api/admin/cleanup-policies — yeni politika oluştur
  fastify.post('/', async (req, reply) => {
    const {
      name,
      max_age_days,
      max_size_mb,
      scope = 'global',
      group_id,
      mime_type_filter,
      action = 'delete',
      cron_expression = '0 2 * * *',
    } = req.body || {};

    if (!name) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Politika adı gerekli.' },
      });
    }

    if (!max_age_days && !max_size_mb && !mime_type_filter) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'En az bir kriter belirtilmeli (max_age_days, max_size_mb, mime_type_filter).' },
      });
    }

    const [policy] = await knex('file_cleanup_policies')
      .insert({
        name: name.trim(),
        max_age_days: max_age_days || null,
        max_size_mb: max_size_mb || null,
        scope,
        group_id: scope === 'group' ? group_id : null,
        mime_type_filter: mime_type_filter || null,
        action,
        cron_expression,
        is_active: true,
        created_by: req.user.id,
      })
      .returning('*');

    return reply.code(201).send({ success: true, data: policy });
  });

  // PATCH /api/admin/cleanup-policies/:id — güncelle
  fastify.patch('/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const policy = await knex('file_cleanup_policies').where({ id }).first();
    if (!policy) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Politika bulunamadı.' } });
    }

    const allowed = ['name', 'max_age_days', 'max_size_mb', 'scope', 'group_id',
                     'mime_type_filter', 'action', 'cron_expression', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return reply.send({ success: true, data: policy });
    }

    updates.updated_at = new Date();
    const [updated] = await knex('file_cleanup_policies').where({ id }).update(updates).returning('*');
    return reply.send({ success: true, data: updated });
  });

  // POST /api/admin/cleanup-policies/:id/run — manuel çalıştır
  fastify.post('/:id/run', async (req, reply) => {
    const id = parseInt(req.params.id, 10);

    const result = await runPolicy(id);

    await knex('audit_logs').insert({
      actor_id: req.user.id,
      action: 'cleanup:run',
      target_type: 'cleanup_policy',
      target_id: id,
      detail_json: result,
      ip_address: req.ip,
    });

    return reply.send({ success: true, data: result });
  });

  // DELETE /api/admin/cleanup-policies/:id
  fastify.delete('/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const deleted = await knex('file_cleanup_policies').where({ id }).delete();
    if (!deleted) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Politika bulunamadı.' } });
    }
    return reply.send({ success: true, data: { message: 'Politika silindi.' } });
  });
}
