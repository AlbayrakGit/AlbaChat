import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { Star, MessageCircle, User, Wifi, WifiOff, ChevronDown, ChevronRight } from 'lucide-react';
import { getSocket } from '@/socket/socketClient';

interface UserItem {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  role: string;
}

export default function UserListPanel() {
  const [search, setSearch] = useState('');
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const { user: me } = useAuthStore();
  const { addGroupToList, setActiveGroup, toggleFavorite, onlineUsers } = useChatStore();

  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await apiClient.get('/users');
      return res.data.users;
    },
    staleTime: 30 * 1000,
  });

  // DM başlat — mesaj ikonu tıklandığında
  const { mutate: startDM } = useMutation({
    mutationFn: (userId: number) =>
      apiClient.post(`/groups/direct/${userId}`).then((r) => r.data.data),
    onSuccess: (group) => {
      addGroupToList(group);
      setActiveGroup(group.id);
      try { getSocket().emit('group:join', { groupId: group.id }); } catch { }
    },
  });

  // Yıldız tıklandığında — DM oluştur/getir + favorilere ekle
  const { mutate: favoriteDM } = useMutation({
    mutationFn: (userId: number) =>
      apiClient.post(`/groups/direct/${userId}`).then((r) => r.data.data),
    onSuccess: (group) => {
      addGroupToList(group);
      const currentGroups = useChatStore.getState().groups;
      const existing = currentGroups.find(g => g.id === group.id);
      if (!existing?.is_favorite) {
        toggleFavorite(group.id);
      }
      try { getSocket().emit('group:join', { groupId: group.id }); } catch { }
    },
  });

  // Socket'ten gelen anlık online durumunu API verisinin üzerine yaz
  const filtered = users.filter((u) => {
    if (u.id === me?.id) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q)
    );
  }).map(u => ({
    ...u,
    is_online: onlineUsers[u.id] !== undefined ? onlineUsers[u.id] : u.is_online,
  }));

  const online = filtered.filter(u => u.is_online);
  const offline = filtered.filter(u => !u.is_online);

  const renderUser = (u: UserItem) => (
    <div
      key={u.id}
      onClick={() => startDM(u.id)}
      className="group flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer rounded-lg mx-1"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {u.avatar_url ? (
          <img
            src={u.avatar_url}
            alt={u.display_name || u.username}
            className="w-9 h-9 rounded-full object-cover shadow-sm"
          />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm bg-blue-500">
            <User className="w-4 h-4" />
          </div>
        )}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 transition-colors duration-300
            ${u.is_online ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        />
      </div>

      {/* Ad Soyad */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
          {u.display_name || u.username}
        </p>
      </div>

      {/* Actions — mobilde her zaman görünür, masaüstünde hover'da */}
      <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); favoriteDM(u.id); }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all active:scale-90"
          title="Favorilere Ekle"
        >
          <Star className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); startDM(u.id); }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all active:scale-90"
          title="Mesaj Gönder"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Arama */}
      <div className="px-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kişi ara..."
          className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2
            focus:outline-none focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
        />
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            {search ? 'Kişi bulunamadı.' : 'Başka kullanıcı yok.'}
          </div>
        ) : (
          <>
            {/* Çevrimiçi — accordion */}
            {online.length > 0 && (
              <div>
                <button
                  onClick={() => setOnlineOpen(!onlineOpen)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {onlineOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Çevrimiçi ({online.length})
                  </span>
                </button>
                {onlineOpen && online.map(renderUser)}
              </div>
            )}

            {/* Çevrimdışı — accordion */}
            {offline.length > 0 && (
              <div>
                {online.length > 0 && (
                  <div className="my-1 mx-3 border-t border-gray-100 dark:border-gray-600" />
                )}
                <button
                  onClick={() => setOfflineOpen(!offlineOpen)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {offlineOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  <WifiOff className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Çevrimdışı ({offline.length})
                  </span>
                </button>
                {offlineOpen && offline.map(renderUser)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
