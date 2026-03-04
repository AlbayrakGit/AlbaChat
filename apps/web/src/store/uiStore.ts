import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  activeGroupId: number | null;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  toast: { message: string; sender: string } | null;

  setSidebarOpen: (open: boolean) => void;
  setActiveGroup: (groupId: number | null) => void;
  setConnectionStatus: (status: 'connected' | 'connecting' | 'disconnected') => void;
  showToast: (sender: string, message: string) => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeGroupId: null,
  connectionStatus: 'disconnected',
  toast: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  showToast: (sender, message) => set({ toast: { sender, message } }),
  clearToast: () => set({ toast: null }),
}));
