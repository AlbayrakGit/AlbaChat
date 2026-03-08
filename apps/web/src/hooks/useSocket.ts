import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initSocket, disconnectSocket, getSocket } from '@/socket/socketClient';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, type Message } from '@/store/chatStore';
import { useUIStore } from '@/store/uiStore';
import { useAnnouncementStore, type Announcement } from '@/store/announcementStore';
import { dequeueAll, removeFromQueue } from '@/lib/offlineQueue';
import { useElectron } from './useElectron';
import { playMessageSound } from '@/utils/sound';

/**
 * Socket.IO bağlantısını yönetir.
 * - Bağlantı durumunu uiStore'a yansıtır
 * - Yeniden bağlanınca: catch-up + offline kuyruk gönderir
 * - Mesaj, silme, yazıyor event'lerini chatStore'a yazar
 */
export function useSocket() {
  const { accessToken, isAuthenticated, user: currentUser } = useAuthStore();
  const { addMessage, updateMessage, removeMessage, setTypingUser, incrementUnread, activeGroupId,
    markMessagesRead, updateGroupInList, addGroupToList, removeGroupFromList, setUserOnlineStatus } = useChatStore();
  const queryClient = useQueryClient();
  const { setConnectionStatus, showToast } = useUIStore();
  const { addToQueue } = useAnnouncementStore();
  const { logout } = useAuthStore();
  const { showNotification, forceShowAnnouncement } = useElectron();

  const isFirstConnectRef = useRef(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Catch-up: son mesaj ID'lerini al, kaçırılanları iste ──────────────
  function sendCatchup() {
    try {
      const socket = getSocket();
      const { messages, groups } = useChatStore.getState();

      const catchupGroups = groups.map((g: import('@/store/chatStore').Group) => {
        const list = messages[g.id] || [];
        const last = list[list.length - 1];
        return { groupId: g.id, lastMessageId: last?.id ?? 0 };
      });

      if (catchupGroups.length > 0) {
        socket.emit('connect:catchup', { groups: catchupGroups });
      }
    } catch {
      // Socket henüz hazır değil
    }
  }

  // ─── Offline kuyrukta bekleyen mesajları gönder ────────────────────────
  async function processOfflineQueue() {
    try {
      const socket = getSocket();
      const queued = await dequeueAll();

      for (const msg of queued) {
        await new Promise<void>((resolve) => {
          socket.emit(
            'message:send',
            { groupId: msg.groupId, content: msg.content, type: msg.type, idempotencyKey: msg.id },
            async (res: { success: boolean }) => {
              if (res?.success) await removeFromQueue(msg.id);
              resolve();
            },
          );
        });
      }

      if (queued.length > 0) {
        console.log(`[OfflineQueue] ${queued.length} mesaj gönderildi`);
      }
    } catch (err) {
      console.error('[OfflineQueue] İşlenemedi:', err);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = initSocket(accessToken);

    // ─── Bağlantı kuruldu ───────────────────────────────────────────────
    socket.on('connect', () => {
      console.log('[Socket] Bağlandı:', socket.id);
      setConnectionStatus('connected');

      if (!isFirstConnectRef.current) {
        // Yeniden bağlandı — kaçırılan mesajları al + offline kuyruğu gönder
        sendCatchup();
        processOfflineQueue();
      }
      isFirstConnectRef.current = false;

      // ─── Heartbeat: 30sn'de bir presence:ping gönder ─────────────────────
      heartbeatRef.current = window.setInterval(() => {
        try { getSocket().emit('presence:ping'); } catch { /* ignore */ }
      }, 30_000);
    });

    // ─── Bağlantı kesildi ───────────────────────────────────────────────
    socket.on('disconnect', (reason: string) => {
      console.log('[Socket] Kesildi:', reason);
      setConnectionStatus('disconnected');
      // Heartbeat'i temizle
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });

    // ─── Yeniden bağlanma denemeleri ────────────────────────────────────
    socket.on('reconnect_attempt', () => {
      setConnectionStatus('connecting');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('connecting');
    });

    // ─── Catch-up yanıtı ────────────────────────────────────────────────
    socket.on('connect:catchup:response', (data: { groups: { groupId: number; messages: Message[] }[] }) => {
      let count = 0;
      for (const { messages } of data.groups) {
        for (const msg of messages) {
          addMessage(msg);
          count++;
        }
      }
      if (count > 0) console.log(`[Catchup] ${count} kaçırılmış mesaj alındı`);
    });

    // ─── Yeni mesaj ─────────────────────────────────────────────────────
    socket.on('message:new', (message: Message) => {
      addMessage(message);

      // Kendi mesajımız değilse bildirim süreçlerini başlat
      if (message.sender_id !== currentUser?.id) {
        // 1. Sesli uyarı
        playMessageSound();

        // 2. Görsel / Panel uyarıları (Eğer grup aktif değilse)
        if (message.group_id !== activeGroupId) {
          incrementUnread(message.group_id);

          const senderName = message.sender?.display_name || message.sender?.username || 'Biri';

          // Toast bildirimi
          showToast(senderName, message.content || '📎 Dosya');

          // Electron: sistem bildirimi
          showNotification(senderName, message.content || '📎 Dosya');
        }
      }
    });

    socket.on('message:deleted', ({ messageId, groupId }: { messageId: number; groupId: number }) => {
      removeMessage(messageId, groupId);
    });

    // ─── Mesaj tepkisi ──────────────────────────────────────────────────
    socket.on('message:reacted', ({ messageId, groupId, reactions }: { messageId: number; groupId: number; reactions: any }) => {
      updateMessage(messageId, groupId, { reactions });
    });

    // ─── Yazıyor göstergesi ─────────────────────────────────────────────
    socket.on('user:typing', ({ groupId, userId, username, displayName, isTyping }: {
      groupId: number; userId: number; username: string; displayName?: string; isTyping: boolean;
    }) => {
      setTypingUser(groupId, { userId, username, displayName }, isTyping);
      if (isTyping) {
        setTimeout(() => setTypingUser(groupId, { userId, username, displayName }, false), 3500);
      }
    });

    // ─── Okundu tik ─────────────────────────────────────────────────────
    socket.on('message:read', ({ groupId, lastMessageId }: {
      groupId: number; lastMessageId: number; userId: number; username: string;
    }) => {
      markMessagesRead(groupId, lastMessageId);
    });

    // ─── Duyuru — gerçek zamanlı yeni duyuru ────────────────────────────
    socket.on('announcement:new', (announcement: Announcement) => {
      addToQueue(announcement);
      // Electron: yerel bildirim + acil duyuruda pencereyi ön plana çek
      showNotification(
        announcement.priority === 'urgent' ? '🔴 Acil Duyuru' : '📢 Duyuru',
        announcement.title,
        announcement.priority === 'urgent',
      );
      if (announcement.priority === 'urgent') {
        forceShowAnnouncement(announcement);
      }
    });

    // ─── Duyuru — bağlantıda okunmamış duyurular ────────────────────────
    socket.on('announcement:pending', (announcements: Announcement[]) => {
      addToQueue(announcements);
    });

    // ─── Online/Offline durum güncellemesi ────────────────────────────────
    socket.on('user:online', ({ userId, isOnline }: { userId: number; username: string; isOnline: boolean }) => {
      // 1. onlineUsers haritasını güncelle (KİŞİLER sekmesi)
      setUserOnlineStatus(userId, isOnline);

      // 2. KİŞİLER listesini güncelle
      queryClient.setQueryData(['users-list'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((u: any) => u.id === userId ? { ...u, is_online: isOnline } : u);
      });

      // 3. DM grubundaki other_user_online alanını güncelle (SOHBETLER sekmesi)
      const { groups } = useChatStore.getState();
      const dmGroup = groups.find(
        (g: import('@/store/chatStore').Group) => g.type === 'direct' && g.other_user_id === userId,
      );
      if (dmGroup) {
        updateGroupInList({ id: dmGroup.id, other_user_online: isOnline });
      }
    });

    // ─── Hesap devre dışı bırakıldı ─────────────────────────────────────
    socket.on('account:disabled', () => {
      disconnectSocket();
      logout();
      window.location.href = '/login?reason=disabled';
    });

    // ─── Grup güncellendi ────────────────────────────────────────────────
    socket.on('group:updated', (group: Parameters<typeof updateGroupInList>[0]) => {
      updateGroupInList(group);
    });

    // ─── Gruba katıldım (üye eklendi) ────────────────────────────────────
    socket.on('group:joined', (group: Parameters<typeof addGroupToList>[0]) => {
      addGroupToList(group);
      socket.emit('group:join', { groupId: group.id });
    });

    // ─── Gruptan çıkarıldım ──────────────────────────────────────────────
    socket.on('group:left', ({ groupId }: { groupId: number }) => {
      removeGroupFromList(groupId);
    });

    // ─── Mobil: arka plandan dönünce socket'i yeniden bağla ──────────────
    const handleResume = () => {
      console.log('[Socket] Uygulama ön plana geldi');
      try {
        const s = getSocket();
        if (!s.connected) {
          console.log('[Socket] Bağlantı kopmuş, yeniden bağlanıyor...');
          s.connect();
        } else {
          // Bağlı ama sunucu offline görmüş olabilir — hemen heartbeat
          s.emit('presence:ping');
          sendCatchup();
        }
      } catch { /* socket yok */ }
    };

    // Capacitor resume + tarayıcı visibility
    document.addEventListener('resume', handleResume);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleResume();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      // Heartbeat'i temizle
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      document.removeEventListener('resume', handleResume);
      document.removeEventListener('visibilitychange', handleVisibility);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect_attempt');
      socket.off('connect_error');
      socket.off('connect:catchup:response');
      socket.off('message:new');
      socket.off('message:deleted');
      socket.off('message:reacted');
      socket.off('user:typing');
      socket.off('message:read');
      socket.off('announcement:new');
      socket.off('announcement:pending');
      socket.off('user:online');
      socket.off('account:disabled');
      socket.off('group:updated');
      socket.off('group:joined');
      socket.off('group:left');
      disconnectSocket();
      isFirstConnectRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken, currentUser?.id]);
}
