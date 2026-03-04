import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { Star, MessageCircle, User } from 'lucide-react';



function getUserColor(_id: number) {
  return 'bg-blue-500';
}
import { getSocket } from '@/socket/socketClient';

interface User {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  role: string;
}



export default function UserListPanel() {
  const [search, setSearch] = useState('');
  const { user: me } = useAuthStore();
  const { addGroupToList, setActiveGroup } = useChatStore();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await apiClient.get('/users');
      return res.data.users;
    },
    staleTime: 30 * 1000,
  });

  const { mutate: startDM } = useMutation({
    mutationFn: (userId: number) =>
      apiClient.post(`/groups/direct/${userId}`).then((r) => r.data.data),
    onSuccess: (group) => {
      addGroupToList(group);
      setActiveGroup(group.id);
      // Socket'i odaya sok (İlk mesaj hatasını önlemek için)
      try { getSocket().emit('group:join', { groupId: group.id }); } catch (e) { }
    },
  });

  const filtered = users.filter((u) => {
    if (u.id === me?.id) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.display_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Arama */}
      <div className="px-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Kullanıcı ara..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
            focus:outline-none focus:border-blue-500 bg-white"
        />
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-400 text-sm">
            {search ? 'Kullanıcı bulunamadı.' : 'Başka kullanıcı yok.'}
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              onClick={() => startDM(u.id)}
              className="group flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-all cursor-pointer border-b border-gray-50 last:border-0"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0 transform transition-transform group-hover:scale-105">
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.display_name || u.username}
                    className="w-10 h-10 rounded-xl object-cover shadow-sm"
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${getUserColor(u.id)}`}>
                    <User className="w-5 h-5" />
                  </div>
                )}
                {/* Online göstergesi */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
                    ${u.is_online ? 'bg-green-500' : 'bg-gray-300'}`}
                />
              </div>

              {/* İsim */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate tracking-tight underline-offset-2 group-hover:underline">
                  {u.display_name || u.username}
                </p>
                <p className="text-[11px] text-gray-500 font-medium truncate opacity-70 italic">@{u.username}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Favori kullanıcı mantığı buraya eklenebilir
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                  title="Favorilere Ekle"
                >
                  <Star className="w-4 h-4" />
                </button>
                <div className="p-1.5 text-blue-600">
                  <MessageCircle className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
