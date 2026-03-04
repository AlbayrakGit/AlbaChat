import { useAnnouncementStore } from '@/store/announcementStore';

interface Props {
  onClick: () => void;
}

export default function AnnouncementBadge({ onClick }: Props) {
  const queue = useAnnouncementStore((s) => s.queue);
  const count = queue.length;

  const hasUrgent = queue.some((a) => a.priority === 'urgent');

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors
        ${hasUrgent
          ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      aria-label={`${count} okunmamış duyuru`}
      title="Duyurular"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span
          className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
            rounded-full text-[10px] font-bold text-white flex items-center justify-center
            ${hasUrgent ? 'bg-red-500' : 'bg-blue-500'}`}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
