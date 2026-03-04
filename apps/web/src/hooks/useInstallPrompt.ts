/**
 * PWA "Ana Ekrana Ekle" kurulum prompt hook'u.
 * beforeinstallprompt eventi yakalanır ve kullanıcıya uygun anda gösterilir.
 */
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches;
  });

  useEffect(() => {
    if (isInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const appInstalledHandler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', appInstalledHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, [isInstalled]);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    setIsInstallable(false);
    setDeferredPrompt(null);
    // 3 gün içinde tekrar sorma
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  // Daha önce kapatıldıysa 3 gün içinde gösterme
  const wasDismissedRecently = () => {
    const ts = localStorage.getItem('pwa-install-dismissed');
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < 3 * 24 * 60 * 60 * 1000;
  };

  return {
    isInstallable: isInstallable && !wasDismissedRecently(),
    isInstalled,
    install,
    dismiss,
  };
}
