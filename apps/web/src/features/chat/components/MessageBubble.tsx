import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { type Message } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/socket/socketClient';
import { apiClient } from '@/api/client';
import { Check, CheckCheck, Trash2, FileIcon, Download, Reply, Forward, ChevronDown, X } from 'lucide-react';

/** Tam ekran dosya/görsel önizleme overlay'i */
function FilePreviewOverlay({ url, fileName, mimeType, downloadUrl, onClose }: {
  url: string; fileName: string; mimeType: string; downloadUrl?: string; onClose: () => void;
}) {
  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isPdf = mimeType === 'application/pdf';

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/90 flex flex-col" onClick={onClose}>
      {/* Üst bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
        <p className="text-white text-sm font-medium truncate flex-1 mr-4">{fileName}</p>
        <div className="flex items-center gap-2">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={fileName}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="İndir"
            >
              <Download className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* İçerik */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={e => e.stopPropagation()}>
        {isImage ? (
          <img src={url} alt={fileName} className="max-w-full max-h-full object-contain rounded" />
        ) : isVideo ? (
          <video src={url} controls className="max-w-full max-h-full rounded" />
        ) : isPdf ? (
          <iframe src={url} className="w-full h-full rounded bg-white" title={fileName} />
        ) : (
          <div className="text-center text-white">
            <FileIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">{fileName}</p>
            <p className="text-sm text-white/60 mt-1">Önizleme desteklenmiyor</p>
            {downloadUrl && (
              <a href={downloadUrl} download={fileName} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" /> İndir
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

interface Props {
  message: Message;
  showSender: boolean;
  isSelected?: boolean;
  highlightId?: number | null;
  onClick?: () => void;
  onReply?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onScrollToMessage?: (messageId: number) => void;
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
  const [showPreview, setShowPreview] = useState(false);

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

  const openPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (url) setShowPreview(true);
  };

  if (isImage && !imgError) {
    return (
      <div className="mt-1 group/image relative" draggable={!!url} onDragStart={handleDragStart}>
        {url ? (
          <div className="relative overflow-hidden rounded-xl">
            <div onClick={openPreview} className="cursor-pointer" title="Ön izleme için tıklayın">
              <img
                src={url}
                alt={file.original_name}
                className="max-w-[280px] sm:max-w-xs max-h-64 min-h-[80px] object-cover block rounded-xl"
                loading="lazy"
                onError={() => setImgError(true)}
              />
            </div>
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
        {showPreview && url && (
          <FilePreviewOverlay
            url={url}
            fileName={file.original_name}
            mimeType={file.mime_type}
            downloadUrl={downloadUrl}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        draggable="true"
        onDragStart={handleDragStart}
        onClick={openPreview}
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
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
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
        <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap bg-white/50 px-1 rounded-sm">
          {formatSize(file.size_bytes)}
        </span>
      </div>
      {showPreview && url && (
        <FilePreviewOverlay
          url={url}
          fileName={file.original_name}
          mimeType={file.mime_type}
          downloadUrl={downloadUrl}
          onClose={() => setShowPreview(false)}
        />
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
  message, anchorRef, isOwn, onClose, onReply, onForward, onDeleteForMe, onDeleteForEveryone
}: {
  message: Message, anchorRef: { x: number; y: number }, isOwn: boolean, onClose: () => void,
  onReply?: (m: Message) => void, onForward?: (m: Message) => void,
  onDeleteForMe: () => void, onDeleteForEveryone: () => void
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const menuW = 170;
    const menuH = 280;
    let top = anchorRef.y;
    let left = anchorRef.x;

    if (top + menuH > window.innerHeight) top = anchorRef.y - menuH;
    if (top < 10) top = 10;
    if (left + menuW > window.innerWidth - 10) left = window.innerWidth - menuW - 10;
    if (left < 10) left = 10;

    setCoords({ top, left });
  }, [anchorRef, isOwn]);

  return (
    <div
      style={{ top: coords.top, left: coords.left }}
      className="fixed min-w-[170px] bg-white dark:bg-gray-800 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-700 py-1.5 z-[9999]"
    >
      {/* Quick Reactions Bar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-50 dark:border-gray-700 mb-1">
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
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-lg leading-none active:scale-125 duration-200"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      <button onClick={(e) => { e.stopPropagation(); onClose(); onReply?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <Reply className="w-3.5 h-3.5 text-blue-500" />
        <span>Yanıtla</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onClose(); onForward?.(message); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <Forward className="w-3.5 h-3.5 text-green-500" />
        <span>İlet</span>
      </button>
      <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); onDeleteForMe(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Benden Sil</span>
      </button>
      {isOwn && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); onDeleteForEveryone(); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Herkesten Sil</span>
        </button>
      )}
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

export default function MessageBubble({ message, showSender, isSelected, highlightId, onClick, onReply, onForward, onScrollToMessage }: Props) {
  const { user } = useAuthStore();
  const isOwn = message.sender_id === user?.id;
  const { sender } = message;
  const displayName = sender.display_name || sender.username;

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  }, []);

  const handleDeleteForMe = useCallback(() => {
    try {
      getSocket().emit('message:delete', { messageId: message.id, forEveryone: false });
    } catch (err) {
      console.error('[MessageBubble] Silme hatası:', err);
    }
  }, [message.id]);

  const handleDeleteForEveryone = useCallback(() => {
    try {
      getSocket().emit('message:delete', { messageId: message.id, forEveryone: true });
    } catch (err) {
      console.error('[MessageBubble] Silme hatası:', err);
    }
  }, [message.id]);

  const isHighlighted = highlightId === message.id;

  if (isOwn) {
    return (
      <div
        id={`message-${message.id}`}
        onClick={onClick}
        className={`flex justify-end mb-1 px-4 group/msg animate-slide-up transition-all cursor-pointer
          ${isHighlighted ? 'bg-amber-100 dark:bg-amber-900/30 animate-pulse' : isSelected ? 'bg-blue-500/5' : ''}`}
      >
        <div className="max-w-[80%] sm:max-w-[70%]">
          {showSender && !message.is_forwarded && (
            <p className="text-[10px] font-bold text-blue-500 mb-0.5 text-right mr-1 opacity-80">{user?.display_name || user?.username}</p>
          )}

          <div className="flex items-end gap-2 relative" onContextMenu={handleContextMenu}>
            <div className={`relative px-3 py-0.5 shadow-sm break-words transition-all duration-300 ring-2 ring-transparent
              ${isSelected ? 'ring-primary/40' : ''}
              ${message.file ? 'bg-transparent shadow-none p-0 ring-0' : 'bg-primary text-primary-foreground rounded-2xl'}`}>

              {message.is_forwarded && (
                <div className="flex items-center justify-end gap-1 mb-1 opacity-70">
                  <Forward className="w-3 h-3 italic" />
                  <span className="text-[10px] italic">iletildi</span>
                </div>
              )}

              {message.reply_to && (
                <div
                  onClick={(e) => { e.stopPropagation(); onScrollToMessage?.(message.reply_to!.id); }}
                  className="mb-2 pl-2 pr-2 py-1.5 bg-black/10 border-l-2 border-white/40 rounded-lg backdrop-blur-sm cursor-pointer hover:bg-black/20 transition-colors"
                >
                  <p className="text-[9px] font-bold text-white/70 mb-0.5">{message.reply_to.sender.username}</p>
                  <p className="text-[11px] text-white/90 line-clamp-1 truncate leading-tight">
                    {message.reply_to.content}
                  </p>
                </div>
              )}

              {message.file ? (
                <FileAttachment file={message.file} isOwn />
              ) : (
                <p className="text-[15px] leading-snug relative z-10 whitespace-pre-wrap">{message.content}</p>
              )}
              {message.reactions && <ReactionsList reactions={message.reactions} isOwn={true} />}
            </div>

            <div className="flex items-center gap-1 opacity-70 mb-1 flex-shrink-0">
              <span className="text-[9px] font-medium tracking-tight text-muted-foreground whitespace-nowrap">{formatTime(message.created_at)}</span>
              <ReadTick isRead={message.isRead ?? false} />
              <button
                onClick={(e) => { e.stopPropagation(); setMenuPos({ x: e.clientX, y: e.clientY }); setShowMenu(!showMenu); }}
                className={`ml-1 p-0.5 rounded text-gray-900 dark:text-gray-100 hover:text-blue-600 transition-all ${showMenu ? 'rotate-180 text-blue-600' : ''}`}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {showMenu && createPortal(
              <>
                <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                <MessageMenu
                  message={message}
                  anchorRef={menuPos}
                  isOwn={true}
                  onClose={() => setShowMenu(false)}
                  onReply={onReply}
                  onForward={onForward}
                  onDeleteForMe={handleDeleteForMe}
                  onDeleteForEveryone={handleDeleteForEveryone}
                />
              </>,
              document.body
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`message-${message.id}`}
      onClick={onClick}
      className={`flex items-end gap-2.5 mb-1 px-4 group/msg animate-slide-up transition-all cursor-pointer
        ${isHighlighted ? 'bg-amber-100 dark:bg-amber-900/30 animate-pulse' : isSelected ? 'bg-blue-500/5' : ''}`}
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
        <div className="flex items-end gap-2 relative" onContextMenu={handleContextMenu}>
          <div className={`relative px-3 py-0.5 break-words shadow-sm border transition-all duration-300 ring-2 ring-transparent
            ${isSelected ? 'ring-primary/40' : ''}
            ${message.file ? 'bg-transparent shadow-none border-none p-0 ring-0' : 'bg-white dark:bg-gray-700 border-gray-100 dark:border-gray-600 rounded-2xl'}`}>

            {message.is_forwarded && (
              <div className="flex items-center gap-1 mb-1 opacity-60">
                <Forward className="w-3 h-3 italic" />
                <span className="text-[10px] italic">iletildi</span>
              </div>
            )}

            {message.reply_to && (
              <div
                onClick={(e) => { e.stopPropagation(); onScrollToMessage?.(message.reply_to!.id); }}
                className="mb-2 pl-2 pr-2 py-1.5 bg-gray-50 dark:bg-white/5 border-l-2 border-primary/40 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <p className="text-[9px] font-bold text-primary mb-0.5">{message.reply_to.sender.username}</p>
                <p className="text-[11px] text-foreground/80 line-clamp-1 truncate leading-tight">{message.reply_to.content}</p>
              </div>
            )}

            {message.file ? (
              <FileAttachment file={message.file} isOwn={false} />
            ) : (
              <p className="text-[15px] leading-snug text-foreground whitespace-pre-wrap">{message.content}</p>
            )}
            {message.reactions && <ReactionsList reactions={message.reactions} isOwn={false} />}
          </div>

          <div className="flex items-center gap-1 opacity-70 mb-1 flex-shrink-0">
            <span className="text-[9px] font-medium tracking-tight text-muted-foreground whitespace-nowrap">{formatTime(message.created_at)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuPos({ x: e.clientX, y: e.clientY }); setShowMenu(!showMenu); }}
              className={`ml-1 p-0.5 rounded text-gray-900 dark:text-gray-100 hover:text-blue-600 transition-all ${showMenu ? 'rotate-180 text-blue-600' : ''}`}
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {showMenu && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <MessageMenu
                message={message}
                anchorRef={menuPos}
                isOwn={false}
                onClose={() => setShowMenu(false)}
                onReply={onReply}
                onForward={onForward}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForEveryone={handleDeleteForEveryone}
              />
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}
