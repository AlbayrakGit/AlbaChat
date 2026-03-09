/**
 * Push Bildirim Servisi — Web Push + FCM birleşik
 *
 * Mesaj geldiğinde çevrimdışı kullanıcılara bildirim gönderir.
 */
import { knex } from '../db/knex.js';
import { sendPushToUsers } from '../routes/push.js';
import { sendFcmToUsers } from '../utils/fcm.js';

/**
 * Yeni mesaj için push bildirim gönder.
 * Sadece çevrimdışı olan grup üyelerine gönderilir.
 */
export async function sendPushForMessage(groupId, sender, message) {
  // Gruptaki diğer üyeleri bul
  const members = await knex('group_members')
    .where('group_id', groupId)
    .whereNot('user_id', sender.id)
    .select('user_id');

  if (members.length === 0) return;

  const memberIds = members.map((m) => m.user_id);

  // Grup bilgisi — DM ise gönderici adı, grup ise grup adı
  const group = await knex('groups').where('id', groupId).first();
  const title = group.type === 'direct'
    ? (sender.display_name || sender.username)
    : (group.name || 'AlbaChat');

  // Mesaj içeriği — dosya ise tür belirt
  let body = message.content || '';
  if (message.type === 'file' || message.file_id) {
    const file = message.file;
    if (file) {
      if (file.mime_type?.startsWith('image/')) body = '📷 Fotoğraf';
      else if (file.mime_type?.startsWith('video/')) body = '🎥 Video';
      else if (file.mime_type?.startsWith('audio/')) body = '🎵 Ses dosyası';
      else body = `📎 ${file.original_name || 'Dosya'}`;
    } else {
      body = '📎 Dosya';
    }
  }

  // Kısa tut
  if (body.length > 100) body = body.slice(0, 97) + '...';

  // DM dışı gruplarda gönderici adını body'ye ekle
  if (group.type !== 'direct') {
    const senderName = sender.display_name || sender.username;
    body = `${senderName}: ${body}`;
  }

  const payload = {
    title,
    body,
    tag: `msg:${message.id}`,
    data: {
      groupId: String(groupId),
      messageId: String(message.id),
      type: 'message',
    },
  };

  // Web Push + FCM paralel gönder — tüm üyelere (uygulama açıksa bildirim bastırılır)
  await Promise.allSettled([
    sendPushToUsers(memberIds, payload),
    sendFcmToUsers(memberIds, payload),
  ]);
}
