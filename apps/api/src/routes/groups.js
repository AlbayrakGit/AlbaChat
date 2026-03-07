import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import {
  listUserGroups,
  getGroupById,
  createGroup,
  updateGroup,
  archiveGroup,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateMemberRole,
  getOrCreateDirectGroup,
  toggleGroupFavorite,
  GroupNotFoundError,
  GroupForbiddenError,
  GroupArchivedError,
  MemberAlreadyExistsError,
  MemberNotFoundError,
} from '../services/groupService.js';
import { clearGroupMessages } from '../services/messageService.js';
import { io } from '../server.js';

/** Bağlı kullanıcının socket'ini id ile bul */
async function findUserSocket(userId) {
  const sockets = await io.fetchSockets();
  return sockets.find((s) => s.data?.user?.id === userId) || null;
}

function handleGroupError(err, reply) {
  if (err instanceof GroupNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof GroupForbiddenError) return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof GroupArchivedError) return reply.code(409).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof MemberAlreadyExistsError) return reply.code(409).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof MemberNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
  throw err;
}

export default async function groupRoutes(fastify) {
  // GET /api/groups — kullanıcının üye olduğu gruplar
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const groups = await listUserGroups(req.user.id);
    return reply.send({ success: true, data: groups });
  });

  // GET /api/groups/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const group = await getGroupById(parseInt(req.params.id, 10), req.user.id, req.user.role);
      return reply.send({ success: true, data: group });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // POST /api/groups — Admin
  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { name, description, type, department_code } = req.body || {};
    if (!name) return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Grup adı gerekli.' } });

    try {
      const group = await createGroup({ name, description, type, department_code, createdBy: req.user.id });
      return reply.code(201).send({ success: true, data: group });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // PATCH /api/groups/:id
  fastify.patch('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const group = await updateGroup(parseInt(req.params.id, 10), req.body || {}, req.user.id, req.user.role);
      io.to(`group:${group.id}`).emit('group:updated', group);
      return reply.send({ success: true, data: group });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // POST /api/groups/:id/archive — Admin veya group admin
  fastify.post('/:id/archive', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const group = await archiveGroup(parseInt(req.params.id, 10), req.user.id, req.user.role);
      io.to(`group:${group.id}`).emit('group:updated', group);
      return reply.send({ success: true, data: group });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // GET /api/groups/:id/members
  fastify.get('/:id/members', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const members = await listGroupMembers(parseInt(req.params.id, 10), req.user.id, req.user.role);
      return reply.send({ success: true, data: members });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // POST /api/groups/:id/members — üye ekle
  fastify.post('/:id/members', { preHandler: [authenticate] }, async (req, reply) => {
    const { user_id } = req.body || {};
    if (!user_id) return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'user_id gerekli.' } });

    const groupId = parseInt(req.params.id, 10);
    try {
      await addGroupMember(groupId, user_id, req.user.id, req.user.role);

      // Yeni üyenin socket'ini bul, odaya ekle ve grup bilgisini gönder
      const group = await getGroupById(groupId, req.user.id, req.user.role);
      const newMemberSocket = await findUserSocket(user_id);
      if (newMemberSocket) {
        newMemberSocket.join(`group:${groupId}`);
        newMemberSocket.emit('group:joined', { ...group, my_role: 'member' });
      }

      io.to(`group:${groupId}`).emit('group:member:added', { groupId, userId: user_id });
      return reply.code(201).send({ success: true, data: { message: 'Üye eklendi.' } });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // DELETE /api/groups/:id/members/:userId — üye çıkar
  fastify.delete('/:id/members/:userId', { preHandler: [authenticate] }, async (req, reply) => {
    const groupId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);
    try {
      await removeGroupMember(groupId, targetUserId, req.user.id, req.user.role);

      // Çıkarılan kullanıcının socket'ini bul, odadan çıkar ve bildir
      const removedSocket = await findUserSocket(targetUserId);
      if (removedSocket) {
        removedSocket.leave(`group:${groupId}`);
        removedSocket.emit('group:left', { groupId });
      }

      io.to(`group:${groupId}`).emit('group:member:removed', { groupId, userId: targetUserId });
      return reply.send({ success: true, data: { message: 'Üye çıkarıldı.' } });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // PATCH /api/groups/:id/members/:userId/role — Admin
  fastify.patch('/:id/members/:userId/role', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { role } = req.body || {};
    if (!role) return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'role gerekli.' } });

    try {
      await updateMemberRole(parseInt(req.params.id, 10), parseInt(req.params.userId, 10), role, req.user.role);
      return reply.send({ success: true, data: { message: 'Rol güncellendi.' } });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // POST /api/groups/direct/:userId — 1-1 DM oluştur veya getir
  fastify.post('/direct/:userId', { preHandler: [authenticate] }, async (req, reply) => {
    const targetId = parseInt(req.params.userId, 10);
    if (targetId === req.user.id) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Kendinizle konuşma başlatamazsınız.' } });
    }
    const group = await getOrCreateDirectGroup(req.user.id, targetId);

    // Her iki tarafın socket'ini de odaya sok — mesajlar anında görünsün
    const mySocket = await findUserSocket(req.user.id);
    const targetSocket = await findUserSocket(targetId);
    if (mySocket) {
      mySocket.join(`group:${group.id}`);
      if (!mySocket.data.groupIds) mySocket.data.groupIds = [];
      if (!mySocket.data.groupIds.includes(group.id)) mySocket.data.groupIds.push(group.id);
    }
    if (targetSocket) {
      targetSocket.join(`group:${group.id}`);
      if (!targetSocket.data.groupIds) targetSocket.data.groupIds = [];
      if (!targetSocket.data.groupIds.includes(group.id)) targetSocket.data.groupIds.push(group.id);
      // Karşı tarafa yeni sohbetin açıldığını bildir
      targetSocket.emit('group:joined', { ...group, my_role: 'member' });
    }

    return reply.send({ success: true, data: group });
  });

  // POST /api/groups/:id/clear — Mesaj geçmişini temizle
  fastify.post('/:id/clear', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      await clearGroupMessages(parseInt(req.params.id, 10), req.user.id);
      return reply.send({ success: true, data: { message: 'Sohbet temizlendi.' } });
    } catch (err) { return handleGroupError(err, reply); }
  });

  // POST /api/groups/:id/favorite — Favori toggle
  fastify.post('/:id/favorite', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const result = await toggleGroupFavorite(parseInt(req.params.id, 10), req.user.id);
      return reply.send({ success: true, data: result });
    } catch (err) { return handleGroupError(err, reply); }
  });
}
