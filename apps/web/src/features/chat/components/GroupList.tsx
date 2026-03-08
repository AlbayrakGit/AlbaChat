import { useState, useCallback, useEffect } from 'react';
import { useChatStore, type Group } from '@/store/chatStore';
import { Star, Trash2, MessageCircle, User, Users } from 'lucide-react';
import { ReactionsList } from './MessageBubble';


const GRADIENTS = [
  'bg-gradient-to-br from-red-500 to-red-700',
  'bg-gradient-to-br from-blue-500 to-blue-700',
  'bg-gradient-to-br from-emerald-500 to-emerald-700',
  'bg-gradient-to-br from-amber-500 to-amber-700',
  'bg-gradient-to-br from-violet-500 to-violet-700',
  'bg-gradient-to-br from-pink-500 to-pink-700',
  'bg-gradient-to-br from-cyan-500 to-cyan-700',
  'bg-gradient-to-br from-orange-500 to-orange-700',
  'bg-gradient-to-br from-indigo-500 to-indigo-700',
  'bg-gradient-to-br from-teal-500 to-teal-700',
  'bg-gradient-to-br from-fuchsia-500 to-fuchsia-700',
];

function getGroupColor(group: Group) {
  if (group.type === 'direct') return 'bg-gradient-to-br from-blue-500 to-blue-700';
  return GRADIENTS[group.id % GRADIENTS.length] || GRADIENTS[0];
}

interface Props {
  groups: Group[];
  activeGroupId: number | null;
  onSelect: (group: Group) => void;
}

function GroupItem({ group, isActive, onSelect }: {
  group: Group;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { toggleFavorite, removeGroupFromList, onlineUsers } = useChatStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // DM gruplarında karşı kullanıcının online durumu
  const isOtherUserOnline = group.type === 'direct' && group.other_user_id != null
    ? !!onlineUsers[group.other_user_id]
    : false;

  useEffect(() => {
    if (confirmDelete) {
      const t = setTimeout(() => setConfirmDelete(false), 3000);
      return () => clearTimeout(t);
    }
  }, [confirmDelete]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
    } else {
      removeGroupFromList(group.id);
      setConfirmDelete(false);
    }
  }, [confirmDelete, group.id, removeGroupFromList]);

  return (
    <div className="group relative pr-1">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${isActive
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
      >
        {/* Avatar + Online Gösterge */}
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform group-hover:scale-105 shadow-md border-2 border-white dark:border-gray-600
            ${isActive ? 'bg-white/20' : getGroupColor(group)}`}>
            {group.type === 'direct' ? (
              <User className="w-5 h-5 drop-shadow-sm" />
            ) : (
              <Users className="w-5 h-5 drop-shadow-sm" />
            )}
          </div>
          {/* Online durum göstergesi — sadece DM gruplarında */}
          {group.type === 'direct' && (
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 transition-colors duration-300
                ${isActive ? 'border-blue-600' : 'border-white'}
                ${isOtherUserOnline ? 'bg-green-500' : 'bg-gray-300'}`}
            />
          )}
        </div>

        {/* İsim + son mesaj */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold truncate tracking-tight ${isActive ? 'text-white' : 'text-gray-900 dark:text-gray-100 group-hover:text-blue-600'}`}>
              {group.name}
            </span>
            {/* Okunmamış badge */}
            {!isActive && (group.unread_count || 0) > 0 && (
              <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 border-2 border-white">
                {group.unread_count! > 99 ? '99+' : group.unread_count}
              </span>
            )}
            {/* Favorite Indicator (Always subtle) */}
            {group.is_favorite && !isActive && (
              <Star className="ml-2 w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
          </div>
          {group.last_message ? (
            <p className={`text-[11px] truncate mt-0.5 font-medium ${isActive ? 'text-blue-100' : 'text-gray-500'}`}>
              <span className="opacity-70">
                {group.last_message.sender?.display_name || group.last_message.sender?.username}:
              </span>{' '}
              {group.last_message.content}
            </p>
          ) : (
            <p className={`text-[11px] italic mt-0.5 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>Henüz mesaj yok</p>
          )}
          {group.last_message?.reactions && (
            <ReactionsList reactions={group.last_message.reactions} />
          )}
        </div>
      </button>

      {/* Overlay Actions */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto
        opacity-0 group-hover:opacity-100`}>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(group.id); }}
          className={`p-1.5 rounded-lg backdrop-blur-md transition-all active:scale-90
            ${group.is_favorite ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-500' : 'bg-white/80 dark:bg-gray-700/80 text-gray-400 hover:text-amber-500'}`}
          title={group.is_favorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
        >
          <Star className={`w-3.5 h-3.5 ${group.is_favorite ? 'fill-amber-500' : ''}`} />
        </button>
        <button
          onClick={handleDelete}
          className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg backdrop-blur-md transition-all active:scale-95
            ${confirmDelete ? 'bg-red-500 text-white shadow-lg shadow-red-200 w-auto' : 'bg-white/80 dark:bg-gray-700/80 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-8'}`}
          title={confirmDelete ? 'Sohbeti Kapatmayı Onayla' : 'Sohbeti Kapat'}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {confirmDelete && <span className="text-[9px] font-black tracking-tighter animate-in fade-in slide-in-from-left-1">EMİN?</span>}
        </button>
      </div>
    </div>
  );
}

export default function GroupList({ groups, activeGroupId, onSelect }: Props) {
  // Departman/özel gruplar her zaman görünür; DM'ler sadece mesaj varsa veya favoriyse
  const visibleGroups = groups.filter(g =>
    g.type === 'department' || g.type === 'private' || g.is_favorite || g.last_message
  );

  if (visibleGroups.length === 0) {
    return (
      <div className="px-3 py-10 text-center text-gray-400">
        <MessageCircle className="w-8 h-8 mx-auto mb-3 opacity-20" />
        <p className="text-xs font-medium tracking-wide">Henüz bir sohbetiniz yok.</p>
        <p className="text-[10px] mt-1 text-gray-300">Kişiler sekmesinden birini seçerek sohbet başlatın.</p>
      </div>
    );
  }

  // Sort: Favorites first, then unread, then latest message
  const sorted = [...visibleGroups].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    const unreadA = a.unread_count || 0;
    const unreadB = b.unread_count || 0;
    if (unreadA !== unreadB) return unreadB - unreadA;
    const dateA = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
    const dateB = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
    return dateB - dateA;
  });

  const favorites = sorted.filter(g => g.is_favorite);
  const others = sorted.filter(g => !g.is_favorite);

  return (
    <div className="space-y-1 py-2 px-2">
      {favorites.length > 0 && (
        <>
          <div className="px-3 py-2 flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Favori Sohbetler</span>
          </div>
          {favorites.map((group) => (
            <GroupItem
              key={group.id}
              group={group}
              isActive={group.id === activeGroupId}
              onSelect={() => onSelect(group)}
            />
          ))}
          {others.length > 0 && (
            <div className="my-4 mx-3 border-t border-gray-100 dark:border-gray-600 flex items-center justify-center">
              <span className="bg-white dark:bg-gray-800 px-2 -mt-2.5 text-[10px] font-bold text-gray-300 dark:text-gray-500 uppercase tracking-widest">Diğerleri</span>
            </div>
          )}
        </>
      )}

      {others.map((group) => (
        <GroupItem
          key={group.id}
          group={group}
          isActive={group.id === activeGroupId}
          onSelect={() => onSelect(group)}
        />
      ))}
    </div>
  );
}
