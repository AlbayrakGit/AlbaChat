import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/socket/socketClient';
import { apiClient } from '@/api/client';
import { Check, CheckCheck, Trash2, FileIcon, Download, Eye, Reply, Forward, Smile, ChevronDown, Heart, ThumbsUp, ThumbsDown, Star as StarIcon, PartyPopper } from 'lucide-react';

interface Props {
  message: Message;
  showSender: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileAttachment({
  file, isOwn,
}: {
  file: NonNullable<Message['file']>;
  isOwn: boolean;
}) {
  const isImage = file.mime_type.startsWith('image/');
  const [imgError, setImgError] = useState(false);

  const { data } = useQuery({
    queryKey: ['file-url', file.id],
    queryFn: async () => {
      const res = await apiClient.get(`/files/${file.id}/url`);
      return res.data.data as { url: string; downloadUrl: string };
    },
    staleTime: 50 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const url = data?.url;
  const downloadUrl = data?.downloadUrl;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (url) {
      e.dataTransfer.setData('DownloadURL', `application/octet-stream:${file.original_name}:${url}`);
    }
  };

  const openBlobUrl = (download: boolean = false) => {
    if (download && downloadUrl) {
      // Create hidden iframe to silently trigger download dialog without leaving page
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      // Remove it after a few seconds so it doesn't clutter DOM
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 5000);
    } else if (url) {
      window.open(url, '_blank');
    }
  };

  if (isImage && !imgError) {
    return (
      <div className="mt-1 group/image relative" draggable={!!url} onDragStart={handleDragStart}>
        {url ? (
          <div className="relative overflow-hidden rounded-xl">
            <img
              src={url}
              alt={file.original_name}
              className="max-w-[280px] sm:max-w-xs max-h-64 min-h-[80px] object-cover block rounded-xl"
              loading="lazy"
              onError={() => setImgError(true)}
            />
            {/* Hover overlay + butonlar */}
            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/30 transition-colors" />
            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
              <button
                onClick={() => openBlobUrl(false)}
                className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all active:scale-95"
                title="Görüntüle"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => openBlobUrl(true)}
                className="p-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-sm transition-all active:scale-95"
                title="Kaydet"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-48 h-32 bg-black/10 dark:bg-white/10 rounded-xl animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      className={`mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-all
        ${isOwn
          ? 'bg-blue-600 border-blue-700 text-white'
          : 'bg-white border-gray-200 text-gray-900'
        }`}
      style={{ minWidth: 220, maxWidth: 320 }}
    >
      <div className={`flex items-center justify-center p-2 rounded-lg flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-blue-50'}`}>
        <FileIcon className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-blue-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>{file.original_name}</p>
        <p className={`text-[11px] mt-0.5 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
          {formatSize(file.size_bytes)}
        </p>
      </div>
      {url ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => openBlobUrl(false)}
            className={`p-1.5 rounded-lg transition-colors ${isOwn ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-100 text-gray-500'}`}
            title="Görüntüle"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openBlobUrl(true)}
            className={`p-1.5 rounded-lg transition-colors ${isOwn ? 'hover:bg-white/20 text-white' : 'hover:bg-blue-50 text-blue-600'}`}
            title="Kaydet"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0 opacity-50" />
      )}
    </div>
  );
}

function getInitials(name: string | null, username: string) {
  const src = name || username;
  return src.slice(0, 2).toUpperCase();
}

function ReadTick({ isRead }: { isRead: boolean }) {
  return isRead ? (
    <CheckCheck className="w-[14px] h-[14px] text-blue-400" strokeWidth={2.5} />
  ) : (
    <Check className="w-[14px] h-[14px] text-muted-foreground/60" strokeWidth={2.5} />
  );
}

function EmojiMenu({ onSelect, onClose }: { onSelect: (emoji: string) => void, onClose: () => void }) {
  const emojis = [
    { char: '❤️', icon: <Heart className="w-4 h-4 text-red-500 fill-red-500" /> },
    { char: '👍', icon: <ThumbsUp className="w-4 h-4 text-blue-500 fill-blue-500" /> },
    { char: '👎', icon: <ThumbsDown className="w-4 h-4 text-gray-500 fill-gray-500" /> },
    { char: '⭐', icon: <StarIcon className="w-4 h-4 text-amber-500 fill-amber-500" /> },
    { char: '🎉', icon: <PartyPopper className="w-4 h-4 text-purple-500" /> },
    { char: '😂', icon: <span className="text-lg leading-none">😂</span> },
  ];

  return (
    <div className="absolute bottom-full mb-2 left-0 bg-white rounded-full shadow-xl border border-gray-100 flex items-center gap-1 p-1 z-[120] animate-in zoom-in-50 duration-200 backdrop-blur-md bg-white/90">
      {emojis.map((e) => (
        <button
          key={e.char}
          onClick={(ev) => { ev.stopPropagation(); onSelect(e.char); onClose(); }}
          className="p-2 hover:bg-gray-100 rounded-full transition-all hover:scale-125 active:scale-90"
        >
          {e.icon}
        </button>
      ))}
    </div>
  );
}

export function ReactionsList({ reactions, isOwn }: { reactions: Record<string, number[]>; isOwn?: boolean }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;

  return (
    <div className={`absolute -bottom-2 ${isOwn ? 'right-2' : 'left-auto right-1'} flex flex-wrap gap-0.5 z-[20]`}>
      {Object.entries(reactions).map(([emoji, users]) => (
        <div
          key={emoji}
          className="flex items-center gap-1 px-1.5 py-0.5 bg-white rounded-full border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform hover:scale-110 select-none animate-in zoom-in-50 duration-200"
        >
          <span className="text-[14px] leading-none">{emoji}</span>
          {users.length > 1 && (
            <span className="text-[10px] font-bold text-gray-400">{users.length}</span>
          )}
        </div>
      ))}
    </div>
  );
}


export default function MessageBubble({ message, showSender, isSelected, onClick, onReply, onForward }: Props) {
  const { user } = useAuthStore();
  const isOwn = message.sender_id === user?.id;
  const { sender } = message;
  const displayName = sender.display_name || sender.username;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      const t = setTimeout(() => setConfirmDelete(false), 4000);
      setDeleteTimer(t);
      return;
    }
    if (deleteTimer) clearTimeout(deleteTimer);
    setConfirmDelete(false);
    setShowMenu(false);
    try {
      getSocket().emit('message:delete', { messageId: message.id });
    } catch (err) {
      console.error('[MessageBubble] Silme hatası:', err);
    }
  }, [confirmDelete, deleteTimer, message.id]);

  if (isOwn) {
    return (
      <div
        onClick={onClick}
        className={`flex justify-end mb-2 px-4 group/msg animate-slide-up transition-all cursor-pointer
          ${showMenu ? 'relative z-[60]' : ''} 
          ${isSelected ? 'bg-blue-500/5' : ''}`}
      >
        <div className="max-w-[80%] sm:max-w-[70%]">
          <div className="flex items-end gap-2 flex-row-reverse">

            {/* Dropdown Toggle */}
            <div className="relative order-first opacity-0 group-hover/msg:opacity-100 transition-opacity self-start mt-1">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`p-1 rounded-full bg-white/90 shadow-sm border border-gray-100 text-gray-400 hover:text-blue-600 transition-all ${showMenu ? 'rotate-180 text-blue-600' : ''}`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* WhatsApp Style Dropdown Menu */}
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
                  <div className="absolute top-7 right-0 min-w-[140px] bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
                    <button onClick={() => { setShowMenu(false); onReply?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Reply className="w-3.5 h-3.5 text-blue-500" />
                      <span>Yanıtla</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Smile className="w-3.5 h-3.5 text-yellow-500" />
                        <span>Tepki</span>
                      </button>
                      {showEmoji && (
                        <EmojiMenu
                          onSelect={(emoji) => {
                            getSocket().emit('message:react', { messageId: message.id, emoji });
                          }}
                          onClose={() => setShowEmoji(false)}
                        />
                      )}
                    </div>
                    <button onClick={() => { setShowMenu(false); onForward?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Forward className="w-3.5 h-3.5 text-green-500" />
                      <span>İlet</span>
                    </button>
                    <div className="h-px bg-gray-50 my-1" />
                    <button
                      onClick={handleDeleteClick}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all
                        ${confirmDelete ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{confirmDelete ? 'EMİN MİSİN?' : 'Sil'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className={`relative px-4 py-1.5 shadow-sm break-words transition-all duration-300 ring-2 ring-transparent
              ${isSelected ? 'ring-primary/40' : ''}
              ${message.file ? 'bg-transparent shadow-none p-0 ring-0' : 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none'}`}>
              {/* Refined clean layout */}

              {message.reply_to && (
                <div className="mb-3 pl-3 pr-2 py-1.5 bg-black/10 border-l-2 border-primary-foreground/40 rounded-lg backdrop-blur-sm">
                  <p className="text-[11px] font-bold tracking-wide uppercase text-primary-foreground/90 mb-0.5 opacity-50">
                    Yanıtlanan Mesaj
                  </p>
                  <p className="text-sm text-primary-foreground/80 line-clamp-2 truncate">
                    {message.reply_to.content}
                  </p>
                </div>
              )}
              {message.file ? (
                <FileAttachment file={message.file} isOwn />
              ) : (
                <p className="text-[15px] leading-relaxed relative z-10 whitespace-pre-wrap">{message.content}</p>
              )}
              {message.reactions && <ReactionsList reactions={message.reactions} isOwn={true} />}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 mt-1 opacity-80">
            <span className="text-[10px] font-semibold tracking-tight text-muted-foreground/80 uppercase">{formatTime(message.created_at)}</span>
            <ReadTick isRead={message.isRead ?? false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-end gap-2.5 mb-2 px-4 group/msg animate-slide-up transition-all cursor-pointer
        ${showMenu ? 'relative z-[60]' : ''}
        ${isSelected ? 'bg-blue-500/5' : ''}`}
    >
      <div className="w-9 h-9 flex-shrink-0 transform transition-transform hover:scale-105">
        {showSender ? (
          sender.avatar_url ? (
            <img
              src={sender.avatar_url}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-background"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white text-[11px] font-bold tracking-wider shadow-sm ring-2 ring-background">
              {getInitials(sender.display_name, sender.username)}
            </div>
          )
        ) : (
          <div className="w-9 h-9" />
        )}
      </div>

      <div className="max-w-[80%] sm:max-w-[70%]">
        {showSender && (
          <p className="text-[11px] font-bold tracking-wide uppercase text-muted-foreground mb-1.5 ml-1">{displayName}</p>
        )}
        <div className="flex items-end gap-2">

          <div className={`relative px-4 py-1.5 break-words shadow-sm border transition-all duration-300 ring-2 ring-transparent
            ${isSelected ? 'ring-primary/40' : ''}
            ${message.file ? 'bg-transparent shadow-none border-none p-0 ring-0' : 'bg-white border-gray-100 rounded-2xl rounded-tl-none'}`}>

            {message.reply_to && (
              <div className="mb-3 pl-3 pr-2 py-1.5 bg-black/5 dark:bg-white/5 border-l-2 border-primary/40 rounded-lg">
                <p className="text-[11px] font-bold tracking-wide uppercase text-primary mb-0.5 opacity-60">
                  Yanıtlanan Mesaj
                </p>
                <p className="text-sm text-foreground/80 line-clamp-2 truncate">{message.reply_to.content}</p>
              </div>
            )}
            {message.file ? (
              <FileAttachment file={message.file} isOwn={false} />
            ) : (
              <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">{message.content}</p>
            )}
            {message.reactions && <ReactionsList reactions={message.reactions} isOwn={false} />}
          </div>

          {/* Dropdown Toggle (Incoming) */}
          <div className="relative opacity-0 group-hover/msg:opacity-100 transition-opacity self-start mt-1">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`p-1 rounded-full bg-white/90 shadow-sm border border-gray-100 text-gray-400 hover:text-blue-600 transition-all ${showMenu ? 'rotate-180 text-blue-600' : ''}`}
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* Menu for Incoming */}
            {showMenu && (
              <>
                <div className="fixed inset-0 z-[100]" onClick={() => setShowMenu(false)} />
                <div className="absolute top-7 left-0 min-w-[140px] bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-[110] animate-in fade-in slide-in-from-top-2 duration-200">
                  <button onClick={() => { setShowMenu(false); onReply?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    <Reply className="w-3.5 h-3.5 text-blue-500" />
                    <span>Yanıtla</span>
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Smile className="w-3.5 h-3.5 text-yellow-500" />
                      <span>Tepki</span>
                    </button>
                    {showEmoji && (
                      <EmojiMenu
                        onSelect={(emoji) => {
                          getSocket().emit('message:react', { messageId: message.id, emoji });
                        }}
                        onClose={() => setShowEmoji(false)}
                      />
                    )}
                  </div>
                  <button onClick={() => { setShowMenu(false); onForward?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    <Forward className="w-3.5 h-3.5 text-green-500" />
                    <span>İlet</span>
                  </button>
                  <div className="h-px bg-gray-50 my-1" />
                  <button
                    onClick={handleDeleteClick}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all
                      ${confirmDelete ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{confirmDelete ? 'EMİN MİSİN?' : 'Sil'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-1.5 ml-1">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground">{formatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
