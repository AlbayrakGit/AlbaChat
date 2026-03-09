import {
  createMessage,
  deleteMessage,
  deleteMessageForEveryone,
  addReaction,
  MessageForbiddenError,
  GroupArchivedError,
} from '../../services/messageService.js';
import { publishMessageNew, publishMessageDeleted, publishMessageReacted } from '../pubsub.js';
import { sendPushForMessage } from '../../services/pushService.js';

/**
 * Mesaj gönderme ve silme event handler'ları
 * message:send  → mesajı kaydet, Redis pub/sub ile yayınla
 * message:delete → soft delete, Redis pub/sub ile bildir
 */
export function setupMessageHandler(io, socket) {
  const user = socket.data.user;

  // ─── message:send ─────────────────────────────────────────────────────────
  socket.on('message:send', async (data, callback) => {
    try {
      const {
        groupId,
        content,
        type = 'text',
        idempotencyKey,
        replyToId = null,
        fileId = null,
        is_forwarded = false,
      } = data || {};

      if (!groupId || (!content?.trim() && !fileId)) {
        return callback?.({ success: false, error: 'groupId ve içeriği (metin veya dosya) zorunlu.' });
      }

      const message = await createMessage({
        groupId,
        senderId: user.id,
        content,
        type,
        idempotencyKey: idempotencyKey || null,
        replyToId,
        fileId,
        isForwarded: is_forwarded,
      });

      // Redis Pub/Sub üzerinden tüm instance'lara yayınla
      await publishMessageNew(groupId, message);

      // Çevrimdışı kullanıcılara push bildirim gönder (arka planda)
      sendPushForMessage(groupId, user, message).catch((err) =>
        console.error('[Push] Mesaj bildirimi hatası:', err.message),
      );

      callback?.({ success: true, messageId: message.id });
    } catch (err) {
      if (err instanceof MessageForbiddenError) {
        callback?.({ success: false, error: 'Bu gruba mesaj gönderme yetkiniz yok.' });
      } else if (err instanceof GroupArchivedError) {
        callback?.({ success: false, error: 'Bu grup arşivlenmiş.' });
      } else {
        console.error('[MessageHandler] message:send error:', err.message);
        callback?.({ success: false, error: 'Mesaj gönderilemedi.' });
      }
    }
  });

  // ─── message:delete ───────────────────────────────────────────────────────
  socket.on('message:delete', async ({ messageId, forEveryone = false }, callback) => {
    try {
      if (forEveryone) {
        const result = await deleteMessageForEveryone(messageId, user.id, user.role);
        // Tüm gruba bildir
        await publishMessageDeleted(result.group_id, messageId);
      } else {
        const result = await deleteMessage(messageId, user.id, user.role);
        // Sadece işlemi yapan tarafa bildir
        socket.emit('message:deleted', { groupId: result.group_id, messageId });
      }

      callback?.({ success: true });
    } catch (err) {
      if (err instanceof MessageForbiddenError) {
        callback?.({ success: false, error: 'Bu mesajı silme yetkiniz yok.' });
      } else {
        console.error('[MessageHandler] message:delete error:', err.message);
        callback?.({ success: false, error: 'Mesaj silinemedi.' });
      }
    }
  });

  // ─── message:react ────────────────────────────────────────────────────────
  socket.on('message:react', async ({ messageId, emoji }, callback) => {
    try {
      const result = await addReaction(messageId, user.id, emoji);

      // Tüm gruba tepkiyi yayınla
      await publishMessageReacted(result.group_id, messageId, result.reactions);

      callback?.({ success: true, reactions: result.reactions });
    } catch (err) {
      console.error('[MessageHandler] message:react error:', err.message);
      callback?.({ success: false, error: 'Tepki verilemedi.' });
    }
  });
}
