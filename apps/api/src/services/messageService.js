import { knex } from '../db/knex.js';

// ─── Hata Sınıfları ────────────────────────────────────────────────────────

export class MessageForbiddenError extends Error {
  constructor(msg = 'Bu gruba mesaj gönderme yetkiniz yok.') {
    super(msg); this.code = 'FORBIDDEN';
  }
}
export class MessageNotFoundError extends Error {
  constructor() { super('Mesaj bulunamadı.'); this.code = 'NOT_FOUND'; }
}
export class GroupArchivedError extends Error {
  constructor() { super('Bu grup arşivlenmiş, yeni mesaj gönderilemez.'); this.code = 'GROUP_ARCHIVED'; }
}

// ─── Yardımcı: JOIN ile tam mesaj objesi ──────────────────────────────────

const MESSAGE_COLS = [
  'm.id', 'm.group_id', 'm.sender_id', 'm.content', 'm.type',
  'm.file_id', 'm.reply_to_id', 'm.idempotency_key', 'm.is_deleted', 'm.created_at', 'm.reactions', 'm.is_forwarded',
  'u.username as sender_username',
  'u.display_name as sender_display_name',
  'u.avatar_url as sender_avatar_url',
  // Alıntı mesaj bilgisi (reply_to)
  'rm.content as reply_content',
  'ru.username as reply_sender_username',
  // Dosya bilgisi
  'f.original_name as file_original_name',
  'f.mime_type as file_mime_type',
  'f.size_bytes as file_size_bytes',
];

/** Standart mesaj sorgusunu başlatır — sender + reply_to + file JOIN'leri ile */
function messageQuery() {
  return knex('messages as m')
    .join('users as u', 'u.id', 'm.sender_id')
    .leftJoin('messages as rm', function () {
      this.on('rm.id', '=', 'm.reply_to_id').andOnVal('rm.is_deleted', false);
    })
    .leftJoin('users as ru', 'ru.id', 'rm.sender_id')
    .leftJoin('files as f', function () {
      this.on('f.id', '=', 'm.file_id').andOnVal('f.is_deleted', false);
    });
}

function formatMessage(row) {
  return {
    id: row.id,
    group_id: row.group_id,
    sender_id: row.sender_id,
    content: row.content,
    type: row.type,
    file_id: row.file_id,
    reply_to_id: row.reply_to_id,
    reply_to:
      row.reply_to_id && row.reply_content != null
        ? {
          id: row.reply_to_id,
          content: row.reply_content,
          sender: { username: row.reply_sender_username },
        }
        : null,
    file: row.file_id && row.file_original_name != null
      ? {
        id: row.file_id,
        original_name: row.file_original_name,
        mime_type: row.file_mime_type,
        size_bytes: row.file_size_bytes,
      }
      : null,
    idempotency_key: row.idempotency_key,
    is_deleted: row.is_deleted,
    created_at: row.created_at,
    reactions: row.reactions || {},
    is_forwarded: !!row.is_forwarded,
    sender: {
      id: row.sender_id,
      username: row.sender_username,
      display_name: row.sender_display_name,
      avatar_url: row.sender_avatar_url,
    },
  };
}

// ─── Servis Fonksiyonları ──────────────────────────────────────────────────

/**
 * Yeni mesaj oluştur (idempotency key ile çift gönderim koruması)
 */
export async function createMessage({
  groupId, senderId, content, type = 'text',
  fileId = null, replyToId = null, idempotencyKey = null, isForwarded = false,
}) {
  // İdempotency kontrolü — aynı key ile tekrar gönderim olursa mevcut mesajı döndür
  if (idempotencyKey) {
    const existing = await messageQuery()
      .where('m.idempotency_key', idempotencyKey)
      .where('m.sender_id', senderId)
      .select(MESSAGE_COLS)
      .first();
    if (existing) return formatMessage(existing);
  }

  // Üyelik kontrolü
  const membership = await knex('group_members')
    .where({ group_id: groupId, user_id: senderId })
    .first();
  if (!membership) throw new MessageForbiddenError();

  // Arşiv kontrolü
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group || group.is_archived) throw new GroupArchivedError();

  // Kaydet
  const [message] = await knex('messages')
    .insert({
      group_id: groupId,
      sender_id: senderId,
      content: content.trim(),
      type,
      file_id: fileId,
      reply_to_id: replyToId || null,
      idempotency_key: idempotencyKey,
      is_forwarded: isForwarded,
    })
    .returning('*');

  // Sender + reply_to bilgisiyle getir
  const full = await messageQuery()
    .where('m.id', message.id)
    .select(MESSAGE_COLS)
    .first();

  return formatMessage(full);
}

/**
 * Grup mesajları — sayfalı, en yeniden en eskiye sıralı DB'den, döndürürken tersine çevir
 */
export async function getGroupMessages(groupId, userId, { page = 1, limit = 50 } = {}) {
  // Üyelik kontrolü
  const membership = await knex('group_members')
    .where({ group_id: groupId, user_id: userId })
    .first();
  if (!membership) throw new MessageForbiddenError();

  const offset = (page - 1) * limit;

  const rows = await messageQuery()
    .where('m.group_id', groupId)
    .where('m.is_deleted', false)
    .whereRaw('NOT (? = ANY(m.deleted_for))', [userId])
    .orderBy('m.created_at', 'desc')
    .offset(offset)
    .limit(limit)
    .select(MESSAGE_COLS);

  const [{ count }] = await knex('messages')
    .where({ group_id: groupId, is_deleted: false })
    .whereRaw('NOT (? = ANY(deleted_for))', [userId])
    .count('id as count');

  return {
    messages: rows.map(formatMessage).reverse(), // Kronolojik sıra
    pagination: {
      page,
      limit,
      total: parseInt(count, 10),
      totalPages: Math.ceil(parseInt(count, 10) / limit),
    },
  };
}

/**
 * Belirli mesaj ID'sinden sonraki mesajlar (catch-up için)
 */
export async function getMessagesSince(groupId, userId, afterId) {
  const membership = await knex('group_members')
    .where({ group_id: groupId, user_id: userId })
    .first();
  if (!membership) throw new MessageForbiddenError();

  const rows = await messageQuery()
    .where('m.group_id', groupId)
    .where('m.id', '>', afterId)
    .where('m.is_deleted', false)
    .whereRaw('NOT (? = ANY(m.deleted_for))', [userId])
    .orderBy('m.created_at', 'asc')
    .limit(200)
    .select(MESSAGE_COLS);

  return rows.map(formatMessage);
}

/**
 * Mesaj sil (Sadece benim için sil)
 */
export async function deleteMessage(messageId, requesterId, requesterRole) {
  const message = await knex('messages').where({ id: messageId }).first();
  if (!message || message.is_deleted) throw new MessageNotFoundError();

  await knex('messages')
    .where({ id: messageId })
    .update({
      deleted_for: knex.raw('array_append(deleted_for, ?)', [parseInt(requesterId, 10)])
    });

  return { id: messageId, group_id: message.group_id };
}

/**
 * Mesaj sil (Herkesten sil) — sadece mesaj sahibi veya admin
 */
export async function deleteMessageForEveryone(messageId, requesterId, requesterRole) {
  const message = await knex('messages').where({ id: messageId }).first();
  if (!message || message.is_deleted) throw new MessageNotFoundError();

  if (message.sender_id !== requesterId && requesterRole !== 'admin') {
    throw new MessageForbiddenError();
  }

  await knex('messages')
    .where({ id: messageId })
    .update({ is_deleted: true, content: null });

  return { id: messageId, group_id: message.group_id };
}

/**
 * Gruba ait tüm mesajları kullanıcı için sil (Sohbeti Temizle)
 */
export async function clearGroupMessages(groupId, userId) {
  // Kullanıcının üye olup olmadığını kontrol et
  const membership = await knex('group_members')
    .where({ group_id: groupId, user_id: userId })
    .first();
  if (!membership) throw new MessageForbiddenError();

  // Halihazırda silinmiş olmayan mesajlara kullanıcı ID'sini ekle
  // (Daha önce eklenmişse tekrar eklenmesin diye ANY kontrolü de yapılabilir ama Knex raw ile basitçe yapıyoruz)
  await knex('messages')
    .where({ group_id: groupId })
    .whereRaw('NOT (? = ANY(deleted_for))', [parseInt(userId, 10)])
    .update({
      deleted_for: knex.raw('array_append(deleted_for, ?)', [parseInt(userId, 10)])
    });

  return { success: true };
}

/**
 * Mesaj tepkisi ekle/kaldır
 */
export async function addReaction(messageId, userId, emoji) {
  const message = await knex('messages').where({ id: messageId }).first();
  if (!message || message.is_deleted) throw new MessageNotFoundError();

  const reactions = message.reactions || {};
  const currentEmojiUsers = reactions[emoji] || [];

  let updatedEmojiUsers;
  if (currentEmojiUsers.includes(userId)) {
    // Zaten vermiş, kaldırıyoruz
    updatedEmojiUsers = currentEmojiUsers.filter(id => id !== userId);
  } else {
    // Yeni veriyor, ekliyoruz (Farklı emoji varsa öncekini siliyor mu? Şimdilik çoklu desteğe girmeyelim, WhatsApp gibi olsun)
    // Ama WhatsApp'ta da bir kişi bir mesaja birden fazla farklı tepki genelde siliyor, 
    // ama bizim şemada basitçe emoji bazlı gidelim.
    updatedEmojiUsers = [...currentEmojiUsers, userId];
  }

  if (updatedEmojiUsers.length === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = updatedEmojiUsers;
  }

  await knex('messages')
    .where({ id: messageId })
    .update({ reactions: JSON.stringify(reactions) });

  return { messageId, group_id: message.group_id, reactions };
}
