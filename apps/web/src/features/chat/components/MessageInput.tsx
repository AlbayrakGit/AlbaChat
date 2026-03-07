import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getSocket } from '@/socket/socketClient';
import { useUIStore } from '@/store/uiStore';
import { enqueueMessage } from '@/lib/offlineQueue';
import FileUploadProgress from './FileUploadProgress';
import { type FileUploadItem } from '@/hooks/useFileUpload';
import { type Message } from '@/store/chatStore';
import { Smile, Paperclip, Send, MousePointer2, X, Reply } from 'lucide-react';

interface Props {
  groupId: number;
  disabled?: boolean;
  uploads?: FileUploadItem[];
  onFilesAdded?: (files: File[]) => void;
  onCancelUpload?: (id: string) => void;
  onRemoveUpload?: (id: string) => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

const TYPING_DEBOUNCE_MS = 2000;

const EMOJIS = [
  '😀', '😂', '😊', '😍', '🥳', '😎', '🤔', '😢', '😮', '😡',
  '👋', '👍', '👌', '💪', '🙏', '🤝', '✌️', '🫡', '❤️', '🔥',
  '✨', '🎉', '💯', '⚡', '🎯', '✅', '❌', '💡', '🌟', '🎊',
];

export default function MessageInput({
  groupId, disabled,
  uploads = [], onFilesAdded, onCancelUpload, onRemoveUpload,
  replyTo, onCancelReply,
}: Props) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const { connectionStatus } = useUIStore();

  useEffect(() => {
    if (!showEmoji) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmoji]);

  const sendTyping = useCallback(
    (typing: boolean) => {
      try {
        getSocket().emit('user:typing', { groupId, isTyping: typing });
      } catch {
        // ...
      }
      isTypingRef.current = typing;
    },
    [groupId],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (!isTypingRef.current) sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), TYPING_DEBOUNCE_MS);
  };

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setContent('');
    sendTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const idempotencyKey = uuidv4();

    try {
      const socket = getSocket();
      const isConnected = connectionStatus === 'connected' && socket.connected;

      if (!isConnected) {
        await enqueueMessage({
          id: idempotencyKey,
          groupId,
          content: trimmed,
          type: 'text',
          timestamp: Date.now(),
        });
      } else {
        socket.emit(
          'message:send',
          { groupId, content: trimmed, type: 'text', idempotencyKey, replyToId: replyTo?.id || null },
          (res: { success: boolean; error?: string }) => {
            if (!res?.success) {
              console.error('[MessageInput] Gönderim hatası:', res?.error);
            }
          },
        );
      }
    } catch (err) {
      console.error('[MessageInput] Hata:', err);
    } finally {
      setIsSending(false);
      onCancelReply?.();
    }
  }, [content, groupId, isSending, sendTyping, connectionStatus, replyTo, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesAdded?.(files);
    }
  };

  return (
    <div
      className={`relative border-t border-gray-200 bg-white flex-shrink-0 transition-colors pb-[env(safe-area-inset-bottom)] ${isDraggingOver ? 'bg-blue-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {isDraggingOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 border-2 border-dashed border-blue-400 m-2 rounded-xl pointer-events-none transition-all">
          <div className="flex flex-col items-center text-blue-600">
            <MousePointer2 className="w-8 h-8 mb-2 animate-bounce" />
            <span className="text-sm font-bold uppercase tracking-wider">Dosyayı Bırakın</span>
          </div>
        </div>
      )}

      {/* Yükleme ilerlemesi */}
      <FileUploadProgress
        uploads={uploads}
        onCancel={onCancelUpload ?? (() => { })}
        onRemove={onRemoveUpload ?? (() => { })}
      />

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 pt-2 pb-1 flex items-center gap-3 bg-blue-50/80 border-t border-blue-100">
          <Reply className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1 min-w-0 border-l-2 border-blue-400 pl-3">
            <p className="text-xs text-gray-700 italic truncate opacity-80">Yanıtlanıyor:</p>
            <p className="text-sm text-gray-600 truncate">{replyTo.content || '📎 Dosya'}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="px-4 py-3 max-w-5xl mx-auto w-full">
        {/* Emoji picker */}
        {showEmoji && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-[70px] left-4 w-72 bg-white border border-gray-200 shadow-xl rounded-xl p-3 z-30 animate-slide-up"
          >
            <div className="grid grid-cols-6 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-xl p-1.5 rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 focus-within:border-blue-400 transition-all">

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              if (files.length > 0) onFilesAdded?.(files);
              if (fileRef.current) fileRef.current.value = '';
            }}
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="flex-shrink-0 w-10 h-10 rounded-lg text-gray-500 hover:text-gray-700
              hover:bg-gray-200/50 flex items-center justify-center transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
            title="Dosya Ekle"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'Kanal kilitli.' : 'Mesajınızı yazın...'}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-gray-900
              focus:outline-none placeholder:text-gray-400
              disabled:text-gray-400 transition-colors
              max-h-40 overflow-y-auto"
            style={{ lineHeight: '1.5' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 160) + 'px';
            }}
          />

          <button
            onClick={() => setShowEmoji((v) => !v)}
            disabled={disabled}
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
              ${showEmoji ? 'bg-yellow-100 text-yellow-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={handleSend}
            disabled={!content.trim() || isSending || disabled}
            className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600 text-white shadow-sm
              flex items-center justify-center hover:bg-blue-700 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
