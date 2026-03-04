import { create } from 'zustand';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface MessageSender {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface MessageReplyTo {
  id: number;
  content: string;
  sender: { username: string };
}

export interface FileInfo {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface Message {
  id: number;
  group_id: number;
  sender_id: number;
  content: string;
  type: string;
  file_id: number | null;
  reply_to_id: number | null;
  reply_to?: MessageReplyTo | null;
  file?: FileInfo | null;
  idempotency_key: string | null;
  created_at: string;
  sender: MessageSender;
  isRead?: boolean;
  reactions?: Record<string, number[]>;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  type: 'department' | 'private' | 'direct';
  department_code: string | null;
  is_archived: boolean;
  my_role: 'owner' | 'admin' | 'member';
  unread_count?: number;
  last_message?: Message | null;
  is_favorite?: boolean;
  other_user_id?: number | null;
  other_user_online?: boolean | null;
}

export interface TypingUser {
  userId: number;
  username: string;
  display_name?: string | null;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface ChatState {
  groups: Group[];
  activeGroupId: number | null;
  messages: Record<number, Message[]>;
  typingUsers: Record<number, TypingUser[]>;
  isLoadingMessages: boolean;
  onlineUsers: Record<number, boolean>;

  setGroups: (groups: Group[]) => void;
  setActiveGroup: (groupId: number | null) => void;
  addGroupToList: (group: Group) => void;
  updateGroupInList: (group: Partial<Group> & { id: number }) => void;
  removeGroupFromList: (groupId: number) => void;
  setMessages: (groupId: number, messages: Message[]) => void;
  prependMessages: (groupId: number, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: number, groupId: number, partial: Partial<Message>) => void;
  removeMessage: (messageId: number, groupId: number) => void;
  setTypingUser: (groupId: number, user: TypingUser, isTyping: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  incrementUnread: (groupId: number) => void;
  clearUnread: (groupId: number) => void;
  markMessagesRead: (groupId: number, lastMessageId: number) => void;
  toggleFavorite: (groupId: number) => void;
  setUserOnlineStatus: (userId: number, isOnline: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  groups: [],
  activeGroupId: null,
  messages: {},
  typingUsers: {},
  isLoadingMessages: false,
  onlineUsers: {},

  setGroups: (groups) => {
    const favsStr = localStorage.getItem('kc-favorites');
    const favIds = favsStr ? JSON.parse(favsStr) as number[] : [];
    const hiddenStr = localStorage.getItem('kc-hidden-groups');
    const hiddenIds = hiddenStr ? JSON.parse(hiddenStr) as number[] : [];
    const visible = groups.filter(g => !hiddenIds.includes(g.id));
    const merged = visible.map(g => ({ ...g, is_favorite: favIds.includes(g.id) }));
    // DM gruplarından ilk online durum haritasını oluştur
    const onlineMap: Record<number, boolean> = {};
    for (const g of groups) {
      if (g.type === 'direct' && g.other_user_id != null) {
        onlineMap[g.other_user_id] = !!g.other_user_online;
      }
    }
    set((s) => ({ groups: merged, onlineUsers: { ...s.onlineUsers, ...onlineMap } }));
  },

  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

  addGroupToList: (group) =>
    set((s) => {
      // Gizleme listesinden çıkar (DM açıldığında veya favori eklendiğinde)
      const hiddenStr = localStorage.getItem('kc-hidden-groups');
      const hiddenIds = hiddenStr ? JSON.parse(hiddenStr) as number[] : [];
      const idx = hiddenIds.indexOf(group.id);
      if (idx !== -1) {
        hiddenIds.splice(idx, 1);
        localStorage.setItem('kc-hidden-groups', JSON.stringify(hiddenIds));
      }
      if (s.groups.some((g) => g.id === group.id)) return s;
      return { groups: [group, ...s.groups] };
    }),

  updateGroupInList: (partial) =>
    set((s) => ({
      groups: s.groups.map((g) => g.id === partial.id ? { ...g, ...partial } : g),
    })),

  removeGroupFromList: (groupId) =>
    set((s) => {
      // Gizlenen grubu localStorage'a kaydet (F5'te geri gelmesin)
      const hiddenStr = localStorage.getItem('kc-hidden-groups');
      const hiddenIds = hiddenStr ? JSON.parse(hiddenStr) as number[] : [];
      if (!hiddenIds.includes(groupId)) {
        hiddenIds.push(groupId);
        localStorage.setItem('kc-hidden-groups', JSON.stringify(hiddenIds));
      }
      return {
        groups: s.groups.filter((g) => g.id !== groupId),
        activeGroupId: s.activeGroupId === groupId ? null : s.activeGroupId,
      };
    }),

  setMessages: (groupId, messages) =>
    set((s) => ({ messages: { ...s.messages, [groupId]: messages } })),

  // Önceki sayfa mesajları öne ekle (sonsuz scroll)
  prependMessages: (groupId, messages) =>
    set((s) => {
      const existing = s.messages[groupId] || [];
      const existingIds = new Set(existing.map((m) => m.id));
      const unique = messages.filter((m) => !existingIds.has(m.id));
      return { messages: { ...s.messages, [groupId]: [...unique, ...existing] } };
    }),

  // Yeni gelen mesajı sona ekle (çift kayıt önle) + grup son mesajını güncelle
  addMessage: (message) =>
    set((s) => {
      const groupMessages = s.messages[message.group_id] || [];
      if (groupMessages.some((m) => m.id === message.id)) return s;

      // Mesaj gelen grup gizlenmişse, gizleme listesinden çıkar
      const hiddenStr = localStorage.getItem('kc-hidden-groups');
      const hiddenIds = hiddenStr ? JSON.parse(hiddenStr) as number[] : [];
      const idx = hiddenIds.indexOf(message.group_id);
      if (idx !== -1) {
        hiddenIds.splice(idx, 1);
        localStorage.setItem('kc-hidden-groups', JSON.stringify(hiddenIds));
      }

      // Grubun last_message önizlemesini güncelle
      const groups = s.groups.map((g) =>
        g.id === message.group_id ? { ...g, last_message: message } : g,
      );
      return {
        messages: { ...s.messages, [message.group_id]: [...groupMessages, message] },
        groups,
      };
    }),

  // Mesajın içeriğini veya diğer alanlarını güncelle
  updateMessage: (messageId, groupId, partial) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [groupId]: (s.messages[groupId] || []).map((m) =>
          m.id === messageId ? { ...m, ...partial } : m
        ),
      },
    })),

  // Silinen mesajı listeden çıkar
  removeMessage: (messageId, groupId) =>
    set((s) => {
      const groupMessages = (s.messages[groupId] || []).filter((m) => m.id !== messageId);
      return { messages: { ...s.messages, [groupId]: groupMessages } };
    }),

  setTypingUser: (groupId, user, isTyping) =>
    set((s) => {
      const current = s.typingUsers[groupId] || [];
      const updated = isTyping
        ? current.some((u) => u.userId === user.userId) ? current : [...current, user]
        : current.filter((u) => u.userId !== user.userId);
      return { typingUsers: { ...s.typingUsers, [groupId]: updated } };
    }),

  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),

  incrementUnread: (groupId) =>
    set((s) => {
      const groups = s.groups.map((g) =>
        g.id === groupId ? { ...g, unread_count: (g.unread_count || 0) + 1 } : g,
      );
      return { groups };
    }),

  clearUnread: (groupId) =>
    set((s) => {
      const groups = s.groups.map((g) =>
        g.id === groupId ? { ...g, unread_count: 0 } : g,
      );
      return { groups };
    }),

  // lastMessageId'ye kadar olan mesajları okundu olarak işaretle
  markMessagesRead: (groupId, lastMessageId) =>
    set((s) => {
      const msgs = (s.messages[groupId] || []).map((m) =>
        m.id <= lastMessageId ? { ...m, isRead: true } : m,
      );
      return { messages: { ...s.messages, [groupId]: msgs } };
    }),

  toggleFavorite: (groupId) =>
    set((s) => {
      const groups = s.groups.map((g) =>
        g.id === groupId ? { ...g, is_favorite: !g.is_favorite } : g,
      );
      // Yerel favorileri kaydet (opsiyonel: backend desteği eklenene kadar)
      const favs = groups.filter((g) => g.is_favorite).map((g) => g.id);
      localStorage.setItem('kc-favorites', JSON.stringify(favs));
      return { groups };
    }),

  setUserOnlineStatus: (userId, isOnline) =>
    set((s) => ({
      onlineUsers: { ...s.onlineUsers, [userId]: isOnline },
    })),
}));
