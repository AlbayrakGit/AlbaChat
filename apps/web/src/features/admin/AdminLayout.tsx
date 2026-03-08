import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Menu, X, ArrowLeft, Users, MessageSquare, Bell, FolderOpen, Settings as SettingsIcon } from 'lucide-react';

const TABS = [
  {
    to: '/admin/users',
    label: 'Kullanıcılar',
    icon: <Users className="w-5 h-5" />,
  },
  {
    to: '/admin/groups',
    label: 'Gruplar',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    to: '/admin/announcements',
    label: 'Duyurular',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    to: '/admin/files',
    label: 'Dosya Yönetimi',
    icon: <FolderOpen className="w-5 h-5" />,
  },
  {
    to: '/admin/settings',
    label: 'Sistem Ayarları',
    icon: <SettingsIcon className="w-5 h-5" />,
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Boyut değiştirme yardımcı fonksiyonu
  const handleResize = (w: number, h: number) => {
    const electron = window.electronAPI as any;
    if (electron?.resizeWindow) {
      electron.resizeWindow(w, h);
    }
  };

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="flex h-[100dvh] bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex flex-col shrink-0 transition-transform duration-300 transform
        md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">AlbaChat</p>
              <p className="text-xs text-gray-400">Yönetim Paneli</p>
            </div>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigasyon */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => {
                handleResize(1200, 825);
                setSidebarOpen(false);
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
        </nav>

        {/* Alt: Chat'e dön + Kullanıcı */}
        <div className="px-3 py-4 border-t border-gray-700 space-y-1">
          <NavLink
            to="/"
            onClick={() => handleResize(800, 825)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Chat'e Dön
          </NavLink>

          <div className="flex items-center gap-3 px-3 py-2.5 mt-1 border-t border-gray-800/50 pt-4">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-gray-600/30">
              {user?.display_name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
              <p className="text-[10px] text-gray-500 truncate uppercase tracking-wider">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Çıkış Yap"
              className="text-gray-500 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="ml-3">
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Yönetim Paneli</h1>
          </div>
        </header>

        {/* İçerik Scroll Alanı — sadece bu alan scroll edilir */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-gray-50/50 dark:bg-gray-900" style={{ overscrollBehavior: 'contain' }}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
