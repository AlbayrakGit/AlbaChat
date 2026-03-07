import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, type Message } from '@/store/chatStore';
import { getSocket } from '@/socket/socketClient';
import { v4 as uuidv4 } from 'uuid';
import { X, Search, Send, Users, User } from 'lucide-react';

interface Props {
    message: Message;
    onClose: () => void;
}

interface ForwardUser {
    id: number;
    username: string;
    display_name: string | null;
    is_online: boolean;
}

export default function ForwardModal({ message, onClose }: Props) {
    const me = useAuthStore((s) => s.user);
    const { addGroupToList, setActiveGroup } = useChatStore();
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState<number | null>(null);

    const { data: users = [] } = useQuery<ForwardUser[]>({
        queryKey: ['users-forward'],
        queryFn: async () => {
            const res = await apiClient.get('/users');
            return res.data.users;
        },
    });

    const { mutate: forwardTo } = useMutation({
        mutationFn: async (userId: number) => {
            setSending(userId);
            const res = await apiClient.post(`/groups/direct/${userId}`);
            return res.data.data;
        },
        onSuccess: (group) => {
            addGroupToList(group);
            const socket = getSocket();

            // Önce odaya katıl, sonra mesajı gönder (callback ile bekle)
            socket.emit('group:join', { groupId: group.id });

            // Kısa gecikme ile odaya katılımın tamamlanmasını bekle
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                setActiveGroup(group.id);
                setSending(null);
                onClose();
            };

            setTimeout(() => {
                socket.emit('message:send', {
                    groupId: group.id,
                    content: message.content || '',
                    type: message.type,
                    fileId: message.file_id ?? message.file?.id ?? null,
                    is_forwarded: true,
                    idempotencyKey: uuidv4(),
                }, () => finish());

                // Fallback: callback gelmezse 3 saniyede kapat
                setTimeout(finish, 3000);
            }, 150);
        },
        onError: () => setSending(null),
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm mx-4 max-h-[70vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                            <Send className="w-4 h-4 text-white" />
                        </div>
                        <h2 className="text-base font-bold text-gray-900">Mesajı İlet</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Forwarded Message Preview */}
                <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">İletilecek Mesaj</p>
                    <p className="text-sm text-gray-700 line-clamp-2">{message.content || `📎 ${message.file?.original_name || 'Dosya'}`}</p>
                </div>

                {/* Search */}
                <div className="px-4 py-3 flex-shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Kişi ara..."
                            className="input-field h-9 pl-9 text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto px-2 pb-3">
                    {filtered.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs">Kişi bulunamadı.</p>
                        </div>
                    ) : (
                        filtered.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => forwardTo(u.id)}
                                disabled={sending !== null}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    <User className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{u.display_name || u.username}</p>
                                    <p className="text-[10px] text-gray-400">@{u.username}</p>
                                </div>
                                {sending === u.id ? (
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                ) : (
                                    <Send className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
