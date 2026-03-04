import { authenticate, requireAdmin } from '../middleware/authenticate.js';
import {
  listUsers,
  getUserById,
  updateUser,
  setUserStatus,
  UserNotFoundError,
  ForbiddenError,
  ValidationError,
} from '../services/userService.js';

export default async function userRoutes(fastify) {
  // GET /api/users?search=&page=&limit=
  fastify.get('/', { preHandler: [authenticate] }, async (req, reply) => {
    const { search = '', page = '1', limit = '200' } = req.query;
    const result = await listUsers({
      search,
      page: Math.max(1, parseInt(page, 10)),
      limit: Math.min(500, Math.max(1, parseInt(limit, 10))),
    });
    return reply.send({ success: true, ...result });
  });

  // GET /api/users/:id
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const user = await getUserById(parseInt(req.params.id, 10));
      return reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  // PATCH /api/users/:id
  fastify.patch('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const user = await updateUser(
        parseInt(req.params.id, 10),
        req.body || {},
        req.user.id,
        req.user.role
      );
      return reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
      if (err instanceof ForbiddenError) return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
      if (err instanceof ValidationError) return reply.code(400).send({ success: false, error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  // PATCH /api/users/:id/status — Admin
  fastify.patch('/:id/status', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { is_active } = req.body || {};
    if (typeof is_active !== 'boolean') {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'is_active boolean olmalı.' } });
    }
    try {
      const user = await setUserStatus(parseInt(req.params.id, 10), is_active);
      return reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
      if (err instanceof ForbiddenError) return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
      throw err;
    }
  });
}
