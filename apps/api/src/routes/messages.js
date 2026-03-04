import { authenticate } from '../middleware/authenticate.js';
import {
  createMessage,
  getGroupMessages,
  getMessagesSince,
  deleteMessage,
  MessageForbiddenError,
  MessageNotFoundError,
  GroupArchivedError,
} from '../services/messageService.js';

function handleError(err, reply) {
  if (err instanceof MessageForbiddenError)
    return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof MessageNotFoundError)
    return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof GroupArchivedError)
    return reply.code(409).send({ success: false, error: { code: err.code, message: err.message } });
  throw err;
}

export default async function messagesRoutes(fastify) {
  // POST /api/messages — REST üzerinden mesaj gönder
  fastify.post('/messages', { preHandler: [authenticate] }, async (req, reply) => {
    const { group_id, content, type, file_id, reply_to_id, idempotency_key } = req.body || {};

    if (!group_id || !content?.trim()) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'group_id ve content gerekli.' },
      });
    }

    try {
      const message = await createMessage({
        groupId: group_id,
        senderId: req.user.id,
        content,
        type,
        fileId: file_id,
        replyToId: reply_to_id,
        idempotencyKey: idempotency_key,
      });
      return reply.code(201).send({ success: true, data: message });
    } catch (err) { return handleError(err, reply); }
  });

  // DELETE /api/messages/:id
  fastify.delete('/messages/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const result = await deleteMessage(
        parseInt(req.params.id, 10),
        req.user.id,
        req.user.role,
      );
      return reply.send({ success: true, data: result });
    } catch (err) { return handleError(err, reply); }
  });

  // GET /api/groups/:id/messages — sayfalı mesaj listesi
  fastify.get('/groups/:id/messages', { preHandler: [authenticate] }, async (req, reply) => {
    const groupId = parseInt(req.params.id, 10);
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const after = req.query.after ? parseInt(req.query.after, 10) : null;

    try {
      if (after !== null) {
        const messages = await getMessagesSince(groupId, req.user.id, after);
        return reply.send({ success: true, data: { messages } });
      }
      const result = await getGroupMessages(groupId, req.user.id, { page, limit });
      return reply.send({ success: true, data: result });
    } catch (err) { return handleError(err, reply); }
  });
}
