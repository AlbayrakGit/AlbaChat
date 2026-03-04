/**
 * Admin — Grup Yönetimi Rotaları
 * GET  /api/admin/groups            — Tüm grupları listele
 * GET  /api/admin/groups/:id/members — Grup üyelerini listele
 * POST /api/admin/groups/:id/members — Gruba üye ekle
 */
import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { knex } from '../../db/knex.js';
import { addGroupMember, removeGroupMember, MemberAlreadyExistsError, GroupNotFoundError } from '../../services/groupService.js';

export async function adminGroupRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  /** Tüm grupları listele (admin yetkisi ile) */
  fastify.get('/', async (_req, reply) => {
    const groups = await knex('groups')
      .select(
        'groups.id',
        'groups.name',
        'groups.description',
        'groups.type',
        'groups.department_code',
        'groups.is_archived',
        'groups.created_by',
        'groups.created_at',
        'groups.updated_at',
        knex.raw('COUNT(DISTINCT gm.user_id) AS member_count'),
      )
      .leftJoin('group_members as gm', 'gm.group_id', 'groups.id')
      .groupBy('groups.id')
      .orderBy('groups.created_at', 'desc');

    return reply.send({ success: true, data: groups });
  });

  /** Grup üyelerini listele */
  fastify.get('/:id/members', async (req, reply) => {
    const groupId = parseInt(req.params.id, 10);
    const group = await knex('groups').where({ id: groupId }).first();
    if (!group) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Grup bulunamadı.' } });

    const members = await knex('group_members')
      .join('users', 'users.id', 'group_members.user_id')
      .where('group_members.group_id', groupId)
      .select(
        'users.id',
        'users.username',
        'users.display_name',
        'users.avatar_url',
        'users.is_online',
        'group_members.role as member_role',
        'group_members.joined_at',
      );

    return reply.send({ success: true, data: members });
  });

  /** Gruba üye ekle */
  fastify.post('/:id/members', async (req, reply) => {
    const groupId = parseInt(req.params.id, 10);
    const { user_id } = req.body || {};

    if (!user_id) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'user_id gerekli.' } });
    }

    const user = await knex('users').where({ id: user_id }).first();
    if (!user) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' } });
    }

    try {
      await addGroupMember(groupId, user_id, req.user.id, 'admin');
      return reply.code(201).send({ success: true, data: { message: 'Üye eklendi.' } });
    } catch (err) {
      if (err instanceof MemberAlreadyExistsError) {
        return reply.code(409).send({ success: false, error: { code: 'ALREADY_MEMBER', message: 'Kullanıcı zaten bu grubun üyesi.' } });
      }
      if (err instanceof GroupNotFoundError) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Grup bulunamadı.' } });
      }
      throw err;
    }
  });

  /** Gruptan üye çıkar */
  fastify.delete('/:id/members/:userId', async (req, reply) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);

    try {
      await removeGroupMember(groupId, userId, req.user.id, 'admin');
      return reply.send({ success: true, data: { message: 'Üye çıkarıldı.' } });
    } catch (err) {
      if (err instanceof GroupNotFoundError) {
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Grup bulunamadı.' } });
      }
      throw err;
    }
  });
}
