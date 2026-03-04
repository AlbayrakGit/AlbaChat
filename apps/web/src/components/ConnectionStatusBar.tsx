import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/uiStore';

/**
 * Bağlantı durum bandı.
 * - Bağlantı kesilince sarı bant göster
 * - Yeniden bağlanınca 3 saniye yeşil bant, sonra gizle
 */
export default function ConnectionStatusBar() {
  const { connectionStatus } = useUIStore();
  const [showRestored, setShowRestored] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string>(connectionStatus);

  useEffect(() => {
    if (prevStatus !== 'connected' && connectionStatus === 'connected') {
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevStatus(connectionStatus);
  }, [connectionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bağlı ve "yeniden bağlandı" mesajı da bitti — hiç gösterme
  if (connectionStatus === 'connected' && !showRestored) return null;

  if (showRestored) {
    return (
      <div
        role="status"
        className="mx-3 mt-3 mb-1 flex items-center justify-center gap-2
          bg-green-500/10 text-green-600 text-[11px] font-bold py-2 px-3 rounded-xl border border-green-500/20 animate-in fade-in slide-in-from-bottom-2"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
        Bağlantı yeniden kuruldu
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="mx-3 mt-3 mb-1 flex items-center justify-center gap-2
        bg-yellow-500/10 text-yellow-700 text-[11px] font-bold py-2 px-3 rounded-xl border border-yellow-500/20 animate-pulse"
    >
      <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      {connectionStatus === 'connecting'
        ? 'Bağlanılıyor...'
        : 'Çevrimdışı Mod'}
    </div>
  );
}
