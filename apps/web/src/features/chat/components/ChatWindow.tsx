import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useChatStore, type Group, type Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/socket/socketClient';
import { useFileUpload } from '@/hooks/useFileUpload';
import { v4 as uuidv4 } from 'uuid';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GroupSettingsPanel from './GroupSettingsPanel';
import ForwardModal from '@/components/ForwardModal';
import { Settings, ChevronLeft, ArrowDownToLine, User, Users, Eraser, Search, X } from 'lucide-react';
const COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-violet-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500',
  'bg-indigo-500', 'bg-teal-500', 'bg-fuchsia-500', 'bg-lime-500'
];

function getGroupColor(group: Group) {
  if (group.type === 'direct') return 'bg-blue-500';
  return COLORS[group.id % COLORS.length];
}

interface Props {
  group: Group;
  onBack?: () => void;
}

function isSameDay(d1: string, d2: string) {
  return new Date(d1).toDateString() === new Date(d2).toDateString();
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Bugün';
  if (d.toDateString() === yesterday.toDateString()) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      <span className="text-[11px] text-gray-400 font-medium bg-white dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

export default function ChatWindow({ group, onBack }: Props) {
  const { messages, setMessages, prependMessages, setLoadingMessages, typingUsers, clearUnread } =
    useChatStore();
  const { mutate: clearChat } = useMutation({
    mutationFn: () => apiClient.post(`/groups/${group.id}/clear`),
    onSuccess: () => {
      setMessages(group.id, []);
    },
  });
  const { uploads, addFiles, cancelUpload, removeUpload } = useFileUpload(group.id);

  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const sentUploadsRef = useRef<Set<string>>(new Set());

  const [olderPage, setOlderPage] = useState(2);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const groupMessages = messages[group.id] || [];
  const typing = typingUsers[group.id] || [];

  const { isLoading } = useQuery({
    queryKey: ['messages', group.id],
    queryFn: async () => {
      const res = await apiClient.get(`/groups/${group.id}/messages?limit=10`);
      const data = res.data.data;
      setMessages(group.id, data.messages);
      setHasMore(data.pagination.totalPages > 1);
      setOlderPage(2);
      return data;
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // ─── Mesaj Gruplama Mantığı ──────────────────────────────────────────────
  // Aynı kişi tarafından 10 saniye içinde gönderilen mesajları tek balonda birleştir
  const filteredMessages = searchQuery
    ? groupMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : groupMessages;

  const groupedMessages = filteredMessages;

  // ─── Klavye Kısayolları (Delete tuşu) ──────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedMessageId) {
        const msg = groupMessages.find(m => m.id === selectedMessageId);
        if (msg && msg.sender_id === (useAuthStore.getState().user?.id)) {
          if (window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
            getSocket().emit('message:delete', { messageId: selectedMessageId });
            setSelectedMessageId(null);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMessageId, groupMessages]);

  useEffect(() => {
    setLoadingMessages(isLoading);
  }, [isLoading, setLoadingMessages]);

  useEffect(() => {
    if (isLoading) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupedMessages.length, isLoading, typing.length]);

  useEffect(() => {
    clearUnread(group.id);
  }, [group.id, clearUnread]);

  useEffect(() => {
    if (groupMessages.length === 0) return;
    const lastMsg = groupMessages[groupMessages.length - 1];
    try {
      getSocket().emit('message:read:ack', { groupId: group.id, lastMessageId: lastMsg.id });
    } catch {
      // ...
    }
  }, [group.id, groupMessages.length]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMore) return;
    setIsLoadingOlder(true);

    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      // Eski mesajlarda da limit 10 olsun mu? Genelde 20-30 daha iyidir ama tutarlı olsun.
      const res = await apiClient.get(`/groups/${group.id}/messages?page=${olderPage}&limit=10`);
      const data = res.data.data;
      prependMessages(group.id, data.messages);
      setHasMore(olderPage < data.pagination.totalPages);
      setOlderPage((p) => p + 1);

      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeight;
      }
    } catch (err) {
      console.error('[ChatWindow] Eski mesajlar yüklenemedi:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [group.id, olderPage, isLoadingOlder, hasMore, prependMessages]);

  useEffect(() => {
    if (!topRef.current || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadOlderMessages();
      },
      { root: scrollContainerRef.current, threshold: 0.1 },
    );

    observer.observe(topRef.current);
    return () => observer.disconnect();
  }, [loadOlderMessages, hasMore, isLoading]);

  useEffect(() => {
    setHasMore(false);
    setOlderPage(2);
  }, [group.id]);

  useEffect(() => {
    const completed = uploads.filter(
      (u) => u.status === 'done' && u.uploadedFile && !sentUploadsRef.current.has(u.id),
    );
    if (completed.length === 0) return;

    for (const item of completed) {
      sentUploadsRef.current.add(item.id);
      const idempotencyKey = uuidv4();
      try {
        getSocket().emit('message:send', {
          groupId: group.id,
          content: item.uploadedFile!.original_name,
          type: 'file',
          fileId: item.uploadedFile!.id,
          idempotencyKey,
        });
        // Gönderildikten sonra listeden hemen kaldır (Kullanıcı talebi 1)
        setTimeout(() => removeUpload(item.id), 500);
      } catch {
        // ...
      }
    }
  }, [uploads, group.id, removeUpload]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (group.is_archived) return;
      setIsDragOver(true);
    },
    [group.is_archived],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (group.is_archived) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFiles(files);
    },
    [group.is_archived, addFiles],
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Mesajlar yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full relative bg-background overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sürükle-bırak overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-white/90 dark:bg-gray-900/90 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-blue-400 rounded-2xl w-[calc(100%-4rem)] h-[calc(100%-4rem)] flex items-center justify-center bg-blue-50 dark:bg-blue-900/20">
            <div className="flex flex-col items-center justify-center text-blue-600">
              <ArrowDownToLine className="w-12 h-12 mb-4" />
              <h3 className="text-lg font-semibold">Dosyayı buraya bırakın</h3>
              <p className="text-sm text-blue-400 mt-1">Yükleme başlayacak</p>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <GroupSettingsPanel group={group} onClose={() => setShowSettings(false)} />
      )}

      {/* Header */}
      <div className="relative z-10 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 flex-shrink-0 shadow-sm box-content">

        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0 active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm ${getGroupColor(group)}`}>
          {group.type === 'direct' ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base leading-tight truncate">{group.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {group.type === 'direct' ? 'Özel Mesaj' : group.type === 'department' ? 'Departman' : 'Grup'}
            {group.is_archived && ' · Arşivlendi'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {showSearch ? (
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1 animate-in slide-in-from-right-2">
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mesajlarda ara..."
                className="bg-transparent border-none outline-none text-xs w-32 sm:w-48 text-gray-700 dark:text-gray-200"
              />
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="flex-shrink-0 p-3 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-300 active:scale-95"
              title="Arama"
            >
              <Search className="w-5 h-5 stroke-[2px]" />
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm('Tüm sohbet geçmişini temizlemek istediğinize emin misiniz?')) {
                clearChat();
              }
            }}
            className="flex-shrink-0 p-3 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-300 active:scale-95"
            title="Sohbeti Temizle"
          >
            <Eraser className="w-5 h-5 stroke-[2px]" />
          </button>

          {group.type !== 'direct' && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex-shrink-0 p-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all duration-300 active:scale-95"
              title="Grup Ayarları"
            >
              <Settings className="w-5 h-5 stroke-[2px] transition-transform duration-500 hover:rotate-90" />
            </button>
          )}
        </div>
      </div>

      {/* Mesaj Listesi */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative z-0"
      >
        <div ref={topRef} className="h-1" />

        {isLoadingOlder && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
            <div className={`w-16 h-16 mb-4 rounded-full flex items-center justify-center ${getGroupColor(group)} bg-opacity-10`}>
              {group.type === 'direct' ? (
                <User className={`w-8 h-8 ${getGroupColor(group).replace('bg-', 'text-')}`} strokeWidth={1.5} />
              ) : (
                <Users className={`w-8 h-8 ${getGroupColor(group).replace('bg-', 'text-')}`} strokeWidth={1.5} />
              )}
            </div>
            <h3 className="text-base font-medium text-gray-500">Henüz mesaj yok</h3>
            <p className="text-sm text-gray-400 mt-1">İlk mesajı göndererek sohbeti başlatın.</p>
          </div>
        ) : (
          <div className="space-y-1 max-w-5xl mx-auto w-full">
            {groupedMessages.map((msg, idx) => {
              const prev = groupedMessages[idx - 1];
              const showDate = !prev || !isSameDay(prev.created_at, msg.created_at);
              const showSender = true; // Her mesaj için isim/avatar gösterilsin (Kullanıcı talebi)

              return (
                <div key={msg.id}>
                  {showDate && <DateSeparator date={msg.created_at} />}
                  <MessageBubble
                    message={msg}
                    showSender={showSender}
                    isSelected={selectedMessageId === msg.id}
                    onClick={() => setSelectedMessageId(msg.id)}
                    onReply={(m) => setReplyTo(m)}
                    onForward={(m) => setForwardMessage(m)}
                  />
                </div>
              );
            })}
          </div>
        )}



        <div ref={bottomRef} className="h-1" />
      </div>

      <div className="relative">
        {typing.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 px-6 pb-6 z-20 pointer-events-none">
            <div className="flex items-center gap-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm w-fit px-4 py-2 rounded-2xl rounded-bl-sm shadow-xl border border-blue-200 dark:border-blue-900 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {typing.map((u) => u.displayName || u.username).join(', ')} yazıyor...
              </span>
            </div>
          </div>
        )}

        {/* Mesaj Giriş Alanı */}
        <MessageInput
          groupId={group.id}
          disabled={group.is_archived}
          uploads={uploads}
          onFilesAdded={addFiles}
          onCancelUpload={cancelUpload}
          onRemoveUpload={removeUpload}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      {/* Forward Modal */}
      {forwardMessage && (
        <ForwardModal message={forwardMessage} onClose={() => setForwardMessage(null)} />
      )}
    </div>
  );
}
