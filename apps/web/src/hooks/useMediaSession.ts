/**
 * useMediaSession — MediaSession API entegrasyonu
 *
 * Mobil tarayıcılarda bildirim panelinde uygulama adı + ikon gösterir.
 * Oynatma kontrol butonları (önceki/sonraki) yeni mesajlara gezinmek için kullanılır.
 * HTTPS gerektiren bir API olduğundan desteklenmeyen ortamlarda sessizce atlanır.
 */
import { useEffect, useCallback } from 'react';

interface MediaSessionOptions {
  /** Aktif grubun adı — bildirim panelinde başlık olarak gösterilir */
  groupName?: string;
  /** Okunmamış mesaj sayısı */
  unreadCount?: number;
  /** Önceki gruba git */
  onPrevious?: () => void;
  /** Sonraki gruba git */
  onNext?: () => void;
}

export function useMediaSession({
  groupName,
  unreadCount = 0,
  onPrevious,
  onNext,
}: MediaSessionOptions = {}) {
  const isSupported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  // Metadata güncelle
  useEffect(() => {
    if (!isSupported) return;

    const title = unreadCount > 0 ? `AlbaChat (${unreadCount})` : 'AlbaChat';
    const artist = groupName || 'Mesajlaşma';

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'AlbaChat',
      artwork: [
        { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }, [isSupported, groupName, unreadCount]);

  // Action handler'ları kaydet
  const registerHandlers = useCallback(() => {
    if (!isSupported) return;

    try {
      if (onPrevious) {
        navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
      }
      if (onNext) {
        navigator.mediaSession.setActionHandler('nexttrack', onNext);
      }
    } catch {
      // Bazı tarayıcılar tüm action'ları desteklemeyebilir
    }
  }, [isSupported, onPrevious, onNext]);

  useEffect(() => {
    registerHandlers();
    return () => {
      if (!isSupported) return;
      try {
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch {
        // ignore
      }
    };
  }, [isSupported, registerHandlers]);

  return { isSupported };
}
