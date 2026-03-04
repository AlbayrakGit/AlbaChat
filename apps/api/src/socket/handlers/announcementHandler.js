import { getPendingAnnouncements } from '../../services/announcementService.js';

/**
 * Kullanıcı bağlandığında okunmamış duyuruları gönderir.
 * Çevrimdışıyken oluşturulan duyuruları da almasını sağlar.
 */
export async function setupAnnouncementHandler(io, socket) {
  const { id: userId } = socket.data.user;

  try {
    const pending = await getPendingAnnouncements(userId);
    if (pending.length > 0) {
      socket.emit('announcement:pending', pending);
    }
  } catch (err) {
    console.error('[AnnouncementHandler] Pending duyurular yüklenemedi:', err.message);
  }
}
