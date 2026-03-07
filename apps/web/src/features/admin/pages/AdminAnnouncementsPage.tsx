import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { Announcement } from '@/store/announcementStore';

export default function AdminAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState<number | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<'global' | 'group'>('global');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

  // Fetch Announcements
  const { data: announcementsData, isLoading: isLoadingAnnouncements, isError: isErrorAnnouncements } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const res = await apiClient.get('/announcements?limit=50');
      // The API returns { announcements: [...], pagination: {...} }
      return res.data.data.announcements as Announcement[];
    },
  });

  // Fetch Groups for Scope
  const { data: groupsData } = useQuery({
    queryKey: ['admin-groups-list'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/groups');
      return res.data.data as { id: number; name: string; type: string }[];
    },
  });

  // Create Mutation
  const { mutate: createAnnouncement, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      console.log('API ye istek atılıyor...');
      const response = await apiClient.post('/announcements', {
        title,
        content,
        scope,
        priority,
        groupIds: scope === 'group' ? selectedGroups : [],
      });
      return response.data;
    },
    onSuccess: () => {
      console.log('Duyuru başarıyla oluşturuldu!');
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      setShowModal(false);
      setTitle('');
      setContent('');
      setScope('global');
      setPriority('normal');
      setSelectedGroups([]);
      alert('Duyurunuz başarıyla yayınlandı!');
    },
    onError: (err: any) => {
      console.error('Duyuru ekleme hatası:', err);
      // Backend hatalarını yakala veya ağ hatalarını göster
      const errorMessage = err.response?.data?.error?.message || err.message || 'Bilinmeyen Hata';
      alert(`Duyuru eklenirken bir hata oluştu:\n${errorMessage}`);
    }
  });

  // Fetch Stats
  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin-announcement-stats', showStatsModal],
    queryFn: async () => {
      if (!showStatsModal) return null;
      const res = await apiClient.get(`/announcements/${showStatsModal}/stats`);
      return res.data.data as { readCount: number; unreadCount: number; readUsers: any[]; unreadUsers: any[] };
    },
    enabled: !!showStatsModal,
  });

  // Notify Mutation
  const { mutate: notifyUsers, isPending: isNotifying } = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post(`/announcements/${id}/notify`);
      return res.data.data;
    },
    onSuccess: (data) => {
      alert(`Bildirim ${data.notified} aktif kullanıcıya iletildi. Toplam okunmayan: ${data.unreadCount}`);
    },
  });

  // Delete Mutation
  const { mutate: deleteAnnouncement, isPending: isDeleting } = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/announcements/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      alert('Duyuru ve ilgili tüm veriler (okunma bilgileri vb.) başarıyla temizlendi.');
    },
    onError: (err: any) => {
      alert(`Duyuru silinirken bir hata oluştu: ${err.message}`);
    },
  });

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`"${title}" başlıklı duyuruyu ve tüm okuma verilerini kalıcı olarak silmek istediğinize emin misiniz?`)) {
      deleteAnnouncement(id);
    }
  };

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    createAnnouncement();
  };

  const toggleGroup = (id: number) => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Duyuru Yönetimi</h1>
          <p className="text-gray-500 mt-0.5 text-xs md:text-sm">Sistem geneline veya belirli gruplara duyuru gönderin.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-semibold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 w-full md:w-auto text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Duyuru
        </button>
      </div>

      {/* Duyuru Listesi */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {isLoadingAnnouncements ? (
          <div className="p-8 text-center text-gray-400">Yükleniyor...</div>
        ) : isErrorAnnouncements ? (
          <div className="p-8 text-center">
            <p className="text-red-500 font-medium">Duyurular yüklenirken bir hata oluştu.</p>
          </div>
        ) : announcementsData?.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Henüz hiç duyuru oluşturulmadı.</div>
        ) : (
          <>
            {/* Desktop: Tablo görünümü */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">Başlık & İçerik</th>
                    <th className="px-6 py-4 font-medium w-32">Kapsam</th>
                    <th className="px-6 py-4 font-medium w-24">Öncelik</th>
                    <th className="px-6 py-4 font-medium w-24">Tarih</th>
                    <th className="px-6 py-4 font-medium text-right w-44">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {announcementsData?.map((ann) => (
                    <tr key={ann.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{ann.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-sm">{ann.content}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ann.scope === 'global' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {ann.scope === 'global' ? 'Global' : 'Grup'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ann.priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {ann.priority === 'urgent' ? 'Acil' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(ann.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setShowStatsModal(ann.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-semibold transition-all">
                            İstatistik
                          </button>
                          <button onClick={() => handleDelete(ann.id, ann.title)} disabled={isDeleting} className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm font-semibold transition-all disabled:opacity-50">
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil: Kart görünümü */}
            <div className="md:hidden divide-y divide-gray-100">
              {announcementsData?.map((ann) => (
                <div key={ann.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{ann.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{ann.content}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ann.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {ann.priority === 'urgent' ? 'ACİL' : 'Normal'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ann.scope === 'global' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {ann.scope === 'global' ? 'Global' : 'Grup'}
                      </span>
                      <span className="text-[10px] text-gray-400">{new Date(ann.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowStatsModal(ann.id)} className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-md text-xs font-semibold">
                        İstatistik
                      </button>
                      <button onClick={() => handleDelete(ann.id, ann.title)} disabled={isDeleting} className="px-2.5 py-1 text-red-500 hover:bg-red-50 rounded-md text-xs font-semibold disabled:opacity-50">
                        Sil
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Yeni Duyuru Modalı */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Yeni Duyuru Oluştur</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duyuru Başlığı</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Kısa ve öz bir başlık..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İçerik</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                  placeholder="Duyurunuzun detaylarını buraya yazın..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik Durumu</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="normal">🔵 Normal (Varsayılan)</option>
                    <option value="urgent">🔴 Acil (Sesli Uyarı & Ekranı Kaplar)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kapsam</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'global' | 'group')}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="global">🌐 Tümü (Herkese Açık)</option>
                    <option value="group">👥 Belirli Gruplar</option>
                  </select>
                </div>
              </div>

              {scope === 'group' && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Hedef Grupları Seçin</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                    {groupsData?.filter(g => g.type !== 'direct')?.map((g) => (
                      <label key={g.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700 truncate">{g.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-60"
                >
                  {isCreating ? 'Yayınlanıyor...' : 'Duyuruyu Yayınla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İstatistik ve Tekrar Gönderme Modalı */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowStatsModal(null)} />
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl z-10 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Okunma İstatistikleri</h2>
              <button onClick={() => setShowStatsModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6">
              {isLoadingStats ? (
                <div className="text-center py-8 text-gray-400">Veriler Yükleniyor...</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-1 bg-green-50 rounded-2xl p-4 text-center border border-green-100">
                      <div className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Okuyanlar</div>
                      <div className="text-3xl font-black text-green-700">{statsData?.readCount}</div>
                    </div>
                    <div className="flex-1 bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                      <div className="text-red-600 text-xs font-bold uppercase tracking-wider mb-1">Okumayanlar</div>
                      <div className="text-3xl font-black text-red-700">{statsData?.unreadCount}</div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-medium text-sm text-gray-700">
                      Okumayan Kullanıcılar ({statsData?.unreadUsers?.length || 0})
                    </div>
                    <ul className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                      {statsData?.unreadUsers?.map((u: any) => (
                        <li key={u.id} className="px-4 py-2 text-sm text-gray-600 flex justify-between">
                          <span>{u.display_name || u.username}</span>
                          <span className="text-gray-400">@{u.username}</span>
                        </li>
                      ))}
                      {statsData?.unreadUsers?.length === 0 && (
                        <li className="px-4 py-4 text-sm text-gray-400 text-center">Herkes okumuş! 🎉</li>
                      )}
                    </ul>
                  </div>

                  <button
                    onClick={() => notifyUsers(showStatsModal)}
                    disabled={isNotifying || statsData?.unreadCount === 0}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Okumayanlara Tekrar Hatırlat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
