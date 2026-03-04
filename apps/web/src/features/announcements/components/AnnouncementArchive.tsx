import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { type Announcement } from '@/store/announcementStore';

interface Props {
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function AnnouncementCard({ ann }: { ann: Announcement }) {
  const [expanded, setExpanded] = useState(false);
  const isUrgent = ann.priority === 'urgent';

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-shadow hover:shadow-md
        ${isUrgent ? 'border-red-200' : 'border-gray-200'}`}
    >
      {/* Başlık */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left flex items-center gap-3 px-4 py-3"
      >
        <span className="text-xl flex-shrink-0">{isUrgent ? '🚨' : '📢'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{ann.title}</p>
          <p className="text-xs text-gray-400">{formatDate(ann.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isUrgent && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
              Acil
            </span>
          )}
          {ann.scope === 'group' && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              Grup
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* İçerik */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {ann.content}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>
              {ann.creator_display_name || ann.creator_username}
            </span>
            {ann.read_count !== null && ann.read_count !== undefined && (
              <span>{ann.read_count} kişi okudu</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnnouncementArchive({ onClose }: Props) {
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'urgent' | 'normal'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements-archive', page],
    queryFn: async () => {
      const res = await apiClient.get(`/announcements?page=${page}&limit=20`);
      return res.data.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const all: Announcement[] = data?.announcements ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  const filtered = all.filter((a) => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase())
      || a.content.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === 'all' || a.priority === filterPriority;
    return matchSearch && matchPriority;
  });

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Başlık */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <span className="text-2xl">📋</span>
          <h2 className="text-lg font-bold text-gray-900 flex-1">Duyuru Arşivi</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filtreler */}
        <div className="px-6 py-3 border-b border-gray-100 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Duyurularda ara..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Tümü</option>
            <option value="urgent">Acil</option>
            <option value="normal">Normal</option>
          </select>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Duyuru bulunamadı.</p>
            </div>
          ) : (
            filtered.map((ann) => <AnnouncementCard key={ann.id} ann={ann} />)
          )}
        </div>

        {/* Sayfalama */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40
                hover:bg-gray-50 transition-colors"
            >
              ← Önceki
            </button>
            <span className="text-sm text-gray-500">
              Sayfa {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40
                hover:bg-gray-50 transition-colors"
            >
              Sonraki →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
