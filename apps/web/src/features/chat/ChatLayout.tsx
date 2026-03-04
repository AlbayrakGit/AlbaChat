import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { useChatStore, type Group } from '@/store/chatStore';
import { useAnnouncementStore } from '@/store/announcementStore';
import { useSocket } from '@/hooks/useSocket';
import { useElectron, useElectronUpdate } from '@/hooks/useElectron';
import { usePushNotification } from '@/hooks/usePushNotification';
import { useMediaSession } from '@/hooks/useMediaSession';
import ConnectionStatusBar from '@/components/ConnectionStatusBar';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';
import AnnouncementModal from '@/features/announcements/components/AnnouncementModal';
import AnnouncementBadge from '@/features/announcements/components/AnnouncementBadge';
import AnnouncementArchive from '@/features/announcements/components/AnnouncementArchive';
import GroupList from './components/GroupList';
import ChatWindow from './components/ChatWindow';
import UserListPanel from './components/UserListPanel';
import MessageToast from '@/components/MessageToast';
import { Settings, LogOut, Lock } from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function ChatLayout() {
  const { user, logout: storeLogout } = useAuthStore();
  const { groups, activeGroupId, setGroups, setActiveGroup } = useChatStore();
  const { queue } = useAnnouncementStore();
  const [showArchive, setShowArchive] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'groups' | 'people'>('groups');
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const { updateBadge, isElectron } = useElectron();
  useElectronUpdate(() => setShowUpdateBanner(true));

  // PWA Service Worker güncelleme eventi
  useEffect(() => {
    const handler = () => setShowUpdateBanner(true);
    window.addEventListener('sw:update-available', handler);
    return () => window.removeEventListener('sw:update-available', handler);
  }, []);

  // Web Push — tarayıcı ortamında push aboneliği
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: subscribePush } = usePushNotification();

  // Sayfa yüklendikten 5 saniye sonra push izni iste (zaten verilmemişse)
  useEffect(() => {
    if (isElectron || !pushSupported || pushSubscribed) return;
    const timer = setTimeout(() => {
      subscribePush();
    }, 5000);
    return () => clearTimeout(timer);
  }, [isElectron, pushSupported, pushSubscribed, subscribePush]);

  // Socket.IO bağlantısını başlat
  useSocket();

  // Grupları yükle
  const { isLoading: loadingGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await apiClient.get('/groups');
      const data: Group[] = res.data.data;
      setGroups(data);
      return data;
    },
    refetchOnWindowFocus: false,
  });

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;

  // Electron tray badge — toplam okunmamış sayacı güncelle
  const totalUnread = groups.reduce((sum, g) => sum + (g.unread_count || 0), 0);
  useEffect(() => {
    updateBadge(totalUnread);
  }, [totalUnread, updateBadge]);

  // MediaSession API — mobil bildirim paneli metadata
  useMediaSession({
    groupName: activeGroup?.name,
    unreadCount: totalUnread,
    onPrevious: () => {
      const idx = groups.findIndex((g) => g.id === activeGroupId);
      if (idx > 0) setActiveGroup(groups[idx - 1].id);
    },
    onNext: () => {
      const idx = groups.findIndex((g) => g.id === activeGroupId);
      if (idx >= 0 && idx < groups.length - 1) setActiveGroup(groups[idx + 1].id);
    },
  });

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Token geçersiz olsa bile logout yap
    }
    storeLogout();
  };

  // Mobilde grup seçilince sidebar'ı gizle (window resize'da sıfırla)
  useEffect(() => {
    const handleResize = () => {
      // md breakpoint'te (≥768px) her zaman her iki panel görünür
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ─── PWA "Ana Ekrana Ekle" Banner ────────────────────────────────── */}
      {!isElectron && <InstallPromptBanner />}

      {/* ─── Güncelleme Banner (Electron + PWA) ─────────────────────────── */}
      {showUpdateBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9998] bg-blue-600 text-white text-sm px-4 py-2 flex items-center justify-between">
          <span>Yeni bir sürüm mevcut. Uygulamayı güncellemek için yeniden başlatın.</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (isElectron) {
                  window.electronAPI?.installUpdate();
                } else {
                  window.location.reload();
                }
              }}
              className="bg-white text-blue-600 px-3 py-1 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              Şimdi Güncelle
            </button>
            <button onClick={() => setShowUpdateBanner(false)} className="text-blue-200 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* ─── Duyuru Modal (tam ekran, kapatılamaz) ───────────────────────── */}
      {queue.length > 0 && <AnnouncementModal announcement={queue[0]} />}

      {/* ─── Mesaj Toast Bildirimi ─────────────────────────────────────── */}
      <MessageToast />

      {/* ─── Duyuru Arşivi ───────────────────────────────────────────────── */}
      {showArchive && <AnnouncementArchive onClose={() => setShowArchive(false)} />}



      {/* ─── Sol Sidebar ─────────────────────────────────────────────────── */}
      {/* Mobil: grup seçilmemişse tam genişlik, seçilmişse gizle */}
      {/* Desktop (md+): her zaman sabit genişlik */}
      <div className={`flex-col bg-white border-r border-gray-200 flex-shrink-0
        w-full md:w-80 shadow-sm z-20
        ${activeGroupId ? 'hidden md:flex' : 'flex'}`}
      >
        {/* Workspace Brand */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 gap-3 flex-shrink-0 bg-white">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-gray-900 text-lg tracking-tight truncate">AlbaChat</h1>
            <p className="text-[10px] text-blue-600 font-semibold -mt-0.5">Kurumsal Mesajlaşma</p>
          </div>
          <AnnouncementBadge onClick={() => setShowArchive(true)} />
        </div>

        {/* Professional Navigation Tabs */}
        <div className="flex p-1.5 bg-gray-50/50 border-b border-gray-100 flex-shrink-0 gap-1">
          <button
            onClick={() => setSidebarTab('groups')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all
              ${sidebarTab === 'groups'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            SOHBETLER
          </button>
          <button
            onClick={() => setSidebarTab('people')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all
              ${sidebarTab === 'people'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
          >
            KİŞİLER
          </button>
        </div>

        {/* Content Area */}
        {sidebarTab === 'groups' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loadingGroups ? (
              <div className="px-4 py-8 text-center text-gray-400 space-y-2">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <span className="text-sm">Yükleniyor...</span>
              </div>
            ) : (
              <GroupList
                groups={groups}
                activeGroupId={activeGroupId}
                onSelect={(g) => setActiveGroup(g.id)}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden pt-3">
            <UserListPanel />
          </div>
        )}

        {/* Connection Status & Profile */}
        <div className="mt-auto flex flex-col flex-shrink-0">
          <ConnectionStatusBar />

          <div className="border-t border-gray-100 p-4 bg-gray-50/30 flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                {(user?.display_name || user?.username || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate tracking-tight">
                {user?.display_name || user?.username}
              </p>
              <p className="text-[10px] text-gray-500 font-semibold truncate uppercase opacity-70">
                {user?.role === 'admin' ? 'Sistem Yöneticisi' : 'Kullanıcı'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all shadow-none hover:shadow-sm"
                  title="Admin Panel"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              )}
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Şifre Değiştir"
              >
                <Lock className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Çıkış Yap"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Şifre Değiştir Modal */}
            {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
          </div>
        </div>
      </div>

      {/* ─── Ana Panel ───────────────────────────────────────────────────── */}
      {/* Mobil: yalnızca grup seçilmişse göster */}
      {/* Desktop: her zaman göster */}
      <div className={`flex-1 flex flex-col min-w-0
        ${!activeGroupId ? 'hidden md:flex' : 'flex'}`}
      >
        {activeGroup ? (
          <ChatWindow
            key={activeGroup.id}
            group={activeGroup}
            onBack={() => setActiveGroup(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-gray-400">
            <div>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-500">Bir sohbet seçin</h3>
              <p className="text-sm text-gray-400 mt-1">Sol panelden bir sohbet seçerek mesajlaşmaya başlayın.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
