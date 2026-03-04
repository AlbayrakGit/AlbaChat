import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { knex } from '../../db/knex.js';

export default async function adminAuditRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/audit-logs?page=&limit=&actor_id=&action=
  fastify.get('/', async (req, reply) => {
    const { page = '1', limit = '50', actor_id, action } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const offset = (pageNum - 1) * limitNum;

    const baseQuery = () =>
      knex('audit_logs as al').modify((q) => {
        if (actor_id) q.where('al.actor_id', parseInt(actor_id, 10));
        if (action) q.where('al.action', action);
      });

    const [logs, [{ count }]] = await Promise.all([
      baseQuery()
        .join('users as u', 'u.id', 'al.actor_id')
        .select(
          'al.id', 'al.actor_id', 'al.action', 'al.target_type', 'al.target_id',
          'al.detail_json', 'al.ip_address', 'al.created_at',
          'u.username as actor_username', 'u.display_name as actor_display_name',
        )
        .orderBy('al.created_at', 'desc')
        .limit(limitNum)
        .offset(offset),
      baseQuery().count('* as count'),
    ]);

    return reply.send({
      success: true,
      data: logs,
      pagination: { page: pageNum, limit: limitNum, total: parseInt(count, 10) },
    });
  });
}
