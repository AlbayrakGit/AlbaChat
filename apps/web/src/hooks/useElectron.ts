/**
 * Electron Desktop entegrasyon hook'u.
 * Tarayıcıda çalışırken tüm çağrılar no-op'tur (güvenli).
 */
import { useEffect } from 'react';

export function useElectron() {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  /** Windows yerel bildirimi göster */
  function showNotification(title: string, body: string, urgent = false) {
    window.electronAPI?.showNotification({ title, body, urgent });
  }

  /** Tray ve görev çubuğu badge güncelle */
  function updateBadge(count: number) {
    window.electronAPI?.updateBadge(count);
  }

  /** Acil duyuruda uygulamayı ön plana çek */
  function forceShowAnnouncement(data: unknown) {
    window.electronAPI?.forceShowAnnouncement(data);
  }

  return { isElectron, showNotification, updateBadge, forceShowAnnouncement };
}

/**
 * Güncelleme bildirimi hook'u.
 * Yeni sürüm hazır olduğunda callback çalışır.
 */
export function useElectronUpdate(onUpdateAvailable: () => void) {
  useEffect(() => {
    window.electronAPI?.onUpdateAvailable(onUpdateAvailable);
  }, [onUpdateAvailable]);
}
