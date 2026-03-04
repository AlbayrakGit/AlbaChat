import { create } from 'zustand';

export interface Announcement {
  id: number;
  title: string;
  content: string;
  scope: 'global' | 'group';
  priority: 'normal' | 'urgent';
  created_by: number;
  creator_username: string;
  creator_display_name: string | null;
  expires_at: string | null;
  created_at: string;
  groups: { id: number; name: string }[];
  read_count?: number | null;
}

interface AnnouncementState {
  // FIFO kuyruk — gösterilmeyi bekleyen duyurular
  queue: Announcement[];
  // Arşiv listesi
  archive: Announcement[];
  archivePage: number;
  archiveTotalPages: number;
  isArchiveLoading: boolean;

  // Actions
  addToQueue: (announcements: Announcement | Announcement[]) => void;
  shiftQueue: () => void; // Baştaki duyuruyu kaldır (okundu)
  setArchive: (items: Announcement[], page: number, totalPages: number) => void;
  setArchiveLoading: (loading: boolean) => void;
  appendArchive: (items: Announcement[], page: number, totalPages: number) => void;
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  queue: [],
  archive: [],
  archivePage: 1,
  archiveTotalPages: 1,
  isArchiveLoading: false,

  addToQueue: (input) => {
    const items = Array.isArray(input) ? input : [input];
    set((state) => {
      // Zaten kuyruktaki veya bilinen ID'leri tekrar ekleme
      const existing = new Set(state.queue.map((a) => a.id));
      const fresh = items.filter((a) => !existing.has(a.id));
      if (fresh.length === 0) return state;
      // urgent duyurular öne geçer
      const merged = [...state.queue, ...fresh].sort((a, b) => {
        if (a.priority === b.priority) return 0;
        return a.priority === 'urgent' ? -1 : 1;
      });
      return { queue: merged };
    });
  },

  shiftQueue: () =>
    set((state) => ({ queue: state.queue.slice(1) })),

  setArchive: (items, page, totalPages) =>
    set({ archive: items, archivePage: page, archiveTotalPages: totalPages }),

  appendArchive: (items, page, totalPages) =>
    set((state) => ({
      archive: [...state.archive, ...items],
      archivePage: page,
      archiveTotalPages: totalPages,
    })),

  setArchiveLoading: (loading) => set({ isArchiveLoading: loading }),
}));
