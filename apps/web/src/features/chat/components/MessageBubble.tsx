import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { type Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/socket/socketClient';
import { apiClient } from '@/api/client';
import { Check, CheckCheck, Trash2, FileIcon, Download, Reply, Forward, ChevronDown } from 'lucide-react';

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

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (url) {
      e.dataTransfer.setData('DownloadURL', `application/octet-stream:${file.original_name}:${url}`);
    }
  };

  if (isImage && !imgError) {
    return (
      <div className="mt-1 group/image relative" draggable={!!url} onDragStart={handleDragStart}>
        {url ? (
          <div className="relative overflow-hidden rounded-xl">
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={stopProp} title="Ön izleme için tıklayın">
              <img
                src={url}
                alt={file.original_name}
                className="max-w-[280px] sm:max-w-xs max-h-64 min-h-[80px] object-cover block rounded-xl cursor-pointer"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            </a>
            <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/30 transition-colors pointer-events-none" />
            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
              <a
                href={downloadUrl}
                download={file.original_name}
                onClick={stopProp}
                className="p-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-sm transition-all active:scale-95"
                title="Kaydet"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        ) : (
          <div className="w-48 h-32 bg-black/10 dark:bg-white/10 rounded-xl animate-pulse" />
        )}
      </div>
    );
  }

  const handleBalloonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center gap-2">
      <div
        draggable="true"
        onDragStart={handleDragStart}
        onClick={handleBalloonClick}
        className={`mt-1 flex items-center gap-2.5 rounded-2xl px-3 py-2 border transition-all
          ${url ? 'cursor-pointer hover:opacity-90 active:scale-[0.98]' : 'cursor-default'}
          ${isOwn
            ? 'bg-blue-600 border-blue-700 text-white'
            : 'bg-white border-gray-200 text-gray-900'
          }`}
        style={{ minWidth: 200, maxWidth: 320 }}
        title={url ? 'Önizleme için tıklayın' : ''}
      >
        <div className={`flex items-center justify-center p-2 rounded-xl flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-blue-50'}`}>
          <FileIcon className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-blue-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-medium truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>
            {file.original_name}
          </p>
          <p className={`text-[10px] mt-0.5 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
            {formatSize(file.size_bytes)}
          </p>
        </div>
      </div>

      {url && (
        <a
          href={downloadUrl}
          download={file.original_name}
          onClick={stopProp}
          className="p-2 rounded-full bg-white shadow-sm border border-gray-100 text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0 active:scale-90"
          title="İndir"
        >
          <Download className="w-5 h-5" />
        </a>
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

function MessageMenu({
  message, anchorId, isOwn, onClose, onReply, onForward, onDelete, confirmDelete
}: {
  message: Message, anchorId: string, isOwn: boolean, onClose: () => void,
  onReply?: (m: Message) => void, onForward?: (m: Message) => void,
  onDelete: (e: React.MouseEvent) => void, confirmDelete: boolean
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const btn = document.getElementById(anchorId);
    if (btn) {
      const rect = btn.getBoundingClientRect();
      let top = rect.bottom + 8;
      let left = isOwn ? rect.right - 140 : rect.left;

      // Prevent overflow
      if (top + 180 > window.innerHeight) {
        top = rect.top - 170;
      }
      if (left < 10) left = 10;
      if (left + 140 > window.innerWidth) left = window.innerWidth - 150;

      setCoords({ top, left });
    }
  }, [anchorId, isOwn]);

  return (
    <div
      ref={menuRef}
      style={{ top: coords.top, left: coords.left }}
      className="fixed min-w-[140px] bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-gray-100 py-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Quick Reactions Bar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-50 mb-1">
        {['❤️', '👍', '👎', '⭐', '🎉', '😊'].map((emoji) => (
          <button
            key={emoji}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              try {
                getSocket().emit('message:react', { messageId: message.id, emoji });
              } catch (err) {
                console.error('Reaction error:', err);
              }
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-lg leading-none active:scale-125 duration-200"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onClose(); onReply?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
        <Reply className="w-3.5 h-3.5 text-blue-500" />
        <span>Yanıtla</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onClose(); onForward?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
        <Forward className="w-3.5 h-3.5 text-green-500" />
        <span>İlet</span>
      </button>
      <div className="h-px bg-gray-50 my-1" />
      <button
        onClick={onDelete}
        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold transition-all
          ${confirmDelete ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-50'}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>{confirmDelete ? 'EMİN MİSİN?' : 'Sil'}</span>
      </button>
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
          className="flex items-center gap-1 px-1.5 py-0.5 bg-white rounded-full border border-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
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
        className={`flex justify-end mb-1 px-4 group/msg animate-slide-up transition-all cursor-pointer
          ${isSelected ? 'bg-blue-500/5' : ''}`}
      >
        <div className="max-w-[80%] sm:max-w-[70%]">
          {showSender && !message.is_forwarded && (
            <p className="text-[10px] font-bold text-blue-500 mb-0.5 text-right mr-1 opacity-80">{user?.display_name || user?.username}</p>
          )}

          <div className="flex items-end gap-2 flex-row-reverse">
            <div className={`relative px-3.5 py-1.5 shadow-sm break-words transition-all duration-300 ring-2 ring-transparent
              ${isSelected ? 'ring-primary/40' : ''}
              ${message.file ? 'bg-transparent shadow-none p-0 ring-0' : 'bg-primary text-primary-foreground rounded-2xl'}`}>

              {message.is_forwarded && (
                <div className="flex items-center justify-end gap-1 mb-1 opacity-70">
                  <Forward className="w-3 h-3 italic" />
                  <span className="text-[10px] italic">iletildi</span>
                </div>
              )}

              {message.reply_to && (
                <div className="mb-2 pl-2 pr-2 py-1.5 bg-black/10 border-l-2 border-white/40 rounded-lg backdrop-blur-sm">
                  <p className="text-[9px] font-bold text-white/70 mb-0.5">iletildi</p>
                  <p className="text-[11px] text-white/90 line-clamp-1 truncate leading-tight">
                    {message.reply_to.content}
                  </p>
                </div>
              )}

              {message.file ? (
                <FileAttachment file={message.file} isOwn />
              ) : (
                <p className="text-[14px] leading-[20px] relative z-10 whitespace-pre-wrap">{message.content}</p>
              )}
              {message.reactions && <ReactionsList reactions={message.reactions} isOwn={true} />}
            </div>

            <div className="relative opacity-0 group-hover/msg:opacity-100 transition-opacity self-start mt-1">
              <button
                id={`msg-btn-${message.id}`}
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className={`p-1 rounded-full bg-white/90 shadow-sm border border-gray-100 text-gray-400 hover:text-blue-600 transition-all ${showMenu ? 'rotate-180 text-blue-600' : ''}`}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {showMenu && createPortal(
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                  <MessageMenu
                    message={message}
                    anchorId={`msg-btn-${message.id}`}
                    isOwn={true}
                    onClose={() => setShowMenu(false)}
                    onReply={onReply}
                    onForward={onForward}
                    onDelete={handleDeleteClick}
                    confirmDelete={confirmDelete}
                  />
                </>,
                document.body
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1 mt-0.5 opacity-70">
            <span className="text-[9px] font-medium tracking-tight text-muted-foreground">{formatTime(message.created_at)}</span>
            <ReadTick isRead={message.isRead ?? false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-end gap-2.5 mb-1 px-4 group/msg animate-slide-up transition-all cursor-pointer
        ${isSelected ? 'bg-blue-500/5' : ''}`}
    >
      <div className="w-9 h-9 flex-shrink-0">
        {sender.avatar_url ? (
          <img
            src={sender.avatar_url}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-background"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white text-[11px] font-bold tracking-wider shadow-sm ring-2 ring-background">
            {getInitials(sender.display_name, sender.username)}
          </div>
        )}
      </div>

      <div className="max-w-[80%] sm:max-w-[70%]">
        {showSender && !message.is_forwarded && (
          <p className="text-[10px] font-bold tracking-wide text-blue-600 mb-0.5 ml-1 opacity-80">{displayName}</p>
        )}
        <div className="flex items-end gap-2">
          <div className={`relative px-3.5 py-1.5 break-words shadow-sm border transition-all duration-300 ring-2 ring-transparent
            ${isSelected ? 'ring-primary/40' : ''}
            ${message.file ? 'bg-transparent shadow-none border-none p-0 ring-0' : 'bg-white border-gray-100 rounded-2xl'}`}>

            {message.is_forwarded && (
              <div className="flex items-center gap-1 mb-1 opacity-60">
                <Forward className="w-3 h-3 italic" />
                <span className="text-[10px] italic">iletildi</span>
              </div>
            )}

            {message.reply_to && (
              <div className="mb-2 pl-2 pr-2 py-1.5 bg-gray-50 dark:bg-white/5 border-l-2 border-primary/40 rounded-lg">
                <p className="text-[9px] font-bold text-primary mb-0.5">iletildi</p>
                <p className="text-[11px] text-foreground/80 line-clamp-1 truncate leading-tight">{message.reply_to.content}</p>
              </div>
            )}

            {message.file ? (
              <FileAttachment file={message.file} isOwn={false} />
            ) : (
              <p className="text-[14px] leading-[20px] text-foreground whitespace-pre-wrap">{message.content}</p>
            )}
            {message.reactions && <ReactionsList reactions={message.reactions} isOwn={false} />}
          </div>

          <div className="relative opacity-0 group-hover/msg:opacity-100 transition-opacity self-start mt-1">
            <button
              id={`msg-btn-${message.id}`}
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className={`p-1 rounded-full bg-white/90 shadow-sm border border-gray-100 text-gray-400 hover:text-blue-600 transition-all ${showMenu ? 'rotate-180 text-blue-600' : ''}`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showMenu && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <MessageMenu
                  message={message}
                  anchorId={`msg-btn-${message.id}`}
                  isOwn={false}
                  onClose={() => setShowMenu(false)}
                  onReply={onReply}
                  onForward={onForward}
                  onDelete={handleDeleteClick}
                  confirmDelete={confirmDelete}
                />
              </>,
              document.body
            )}
          </div>
        </div>
        <div className="mt-1 ml-1 opacity-70 text-left">
          <span className="text-[9px] font-medium tracking-tight text-muted-foreground">{formatTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
