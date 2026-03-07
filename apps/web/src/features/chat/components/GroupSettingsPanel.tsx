import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { type Group } from '@/store/chatStore';

interface Member {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  member_role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

function getInitials(name: string | null, username: string) {
  return (name || username).slice(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Sahip',
  admin: 'Yönetici',
  member: 'Üye',
};

interface Props {
  group: Group;
  onClose: () => void;
}

export default function GroupSettingsPanel({ group, onClose }: Props) {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveTimer, setArchiveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const canManage = group.my_role === 'owner' || group.my_role === 'admin' || me?.role === 'admin';

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['group-members', group.id],
    queryFn: async () => {
      const res = await apiClient.get(`/groups/${group.id}/members`);
      return res.data.data;
    },
  });

  const { mutate: archiveGroup, isPending: archivePending } = useMutation({
    mutationFn: () => apiClient.post(`/groups/${group.id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      onClose();
    },
  });

  const { mutate: removeMember, isPending: removePending } = useMutation({
    mutationFn: (userId: number) => apiClient.delete(`/groups/${group.id}/members/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', group.id] });
    },
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      apiClient.patch(`/groups/${group.id}/members/${userId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', group.id] });
    },
  });

  const handleArchiveClick = () => {
    if (!confirmArchive) {
      setConfirmArchive(true);
      const t = setTimeout(() => setConfirmArchive(false), 3000);
      setArchiveTimer(t);
      return;
    }
    if (archiveTimer) clearTimeout(archiveTimer);
    setConfirmArchive(false);
    archiveGroup();
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Başlık */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{group.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {group.type === 'direct' ? 'Özel mesaj' : group.type === 'department' ? 'Departman' : 'Özel grup'}
              {group.is_archived && ' · Arşivlendi'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Üye listesi */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 pt-4 pb-1">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Üyeler ({members.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8 text-gray-400">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
          ) : (
            <div className="px-3 py-2 space-y-1">
              {members.map((member) => {
                const isMe = member.id === me?.id;
                const canRemove = canManage && !isMe && member.member_role !== 'owner';
                const canChangeRole = me?.role === 'admin' && !isMe && member.member_role !== 'owner';

                return (
                  <div key={member.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.display_name || member.username}
                          className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                          {getInitials(member.display_name, member.username)}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800
                        ${member.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>

                    {/* İsim */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {member.display_name || member.username}
                        {isMe && <span className="ml-1 text-xs text-gray-400">(Sen)</span>}
                      </p>
                      <p className="text-xs text-gray-400">{ROLE_LABELS[member.member_role]}</p>
                    </div>

                    {/* Rol değiştir (Admin) */}
                    {canChangeRole && (
                      <select
                        value={member.member_role}
                        onChange={(e) => updateRole({ userId: member.id, role: e.target.value })}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200 focus:outline-none"
                      >
                        <option value="member">Üye</option>
                        <option value="admin">Yönetici</option>
                      </select>
                    )}

                    {/* Çıkar butonu */}
                    {canRemove && (
                      <button
                        onClick={() => removeMember(member.id)}
                        disabled={removePending}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Gruptan çıkar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alt aksiyonlar */}
        {canManage && !group.is_archived && group.type !== 'direct' && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4">
            <button
              onClick={handleArchiveClick}
              disabled={archivePending}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                ${confirmArchive
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
            >
              {confirmArchive ? 'Arşivlemek istediğine emin misin?' : 'Grubu Arşivle'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
