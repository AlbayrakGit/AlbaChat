import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAnnouncementStore, type Announcement } from '@/store/announcementStore';
import { sanitizeText } from '@/utils/sanitize';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  announcement: Announcement;
}

export default function AnnouncementModal({ announcement }: Props) {
  const { shiftQueue } = useAnnouncementStore();
  // Sesli uyarı — urgent duyurularda
  useEffect(() => {
    if (announcement.priority === 'urgent') {
      try {
        // Basit osilatör tabanlı bip sesi (Web Audio API)
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);
        // İkinci bip
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.9);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.9);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.7);
        osc2.start(ctx.currentTime + 0.9);
        osc2.stop(ctx.currentTime + 1.7);
      } catch {
        // AudioContext desteklenmiyorsa sessiz devam
      }
    }
  }, [announcement.id, announcement.priority]);

  const { mutate: markRead, isPending } = useMutation({
    mutationFn: () => apiClient.post(`/announcements/${announcement.id}/read`),
    onSuccess: () => {
      shiftQueue();
    },
    onError: () => {
      // Duyuru silinmiş veya erişilemiyorsa modalı kapat — takılıp kalmasın
      shiftQueue();
    },
  });

  const handleRead = () => {
    if (isPending) return;
    markRead();
  };

  const isUrgent = announcement.priority === 'urgent';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay — tıklanabilir değil */}
      <div
        className={`absolute inset-0 ${isUrgent ? 'bg-red-900/80' : 'bg-gray-900/75'} backdrop-blur-sm`}
      />

      <div
        className={`relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden
          ${isUrgent ? 'ring-4 ring-red-500' : 'ring-2 ring-blue-200'}`}
      >
        {/* Başlık çubuğu */}
        <div
          className={`px-8 py-5 flex items-center gap-4
            ${isUrgent ? 'bg-red-600' : 'bg-blue-600'}`}
        >
          {isUrgent ? (
            <span className="text-3xl animate-pulse">🚨</span>
          ) : (
            <span className="text-3xl">📢</span>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-widest mb-0.5
              ${isUrgent ? 'text-red-200' : 'text-blue-200'}`}>
              {isUrgent ? 'Acil Duyuru' : 'Duyuru'}
            </p>
            <h2 className="text-xl font-bold text-white leading-tight">{announcement.title}</h2>
          </div>
        </div>

        {/* İçerik */}
        <div className="bg-white dark:bg-gray-800 px-8 py-6 max-h-[50vh] overflow-y-auto">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
            {sanitizeText(announcement.content)}
          </p>
        </div>

        {/* Alt bilgi + Okundu butonu */}
        <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-8 py-5 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400 min-w-0">
            <p className="font-medium text-gray-700 dark:text-gray-300 truncate">
              {announcement.creator_display_name || announcement.creator_username}
            </p>
            <p>{formatDate(announcement.created_at)}</p>
          </div>

          <button
            onClick={handleRead}
            disabled={isPending}
            className={`flex-shrink-0 px-8 py-3 rounded-2xl font-semibold text-white
              transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed
              ${isUrgent
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200'
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200'
              }`}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Kaydediliyor...
              </span>
            ) : (
              'Okudum, Anladım ✓'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
