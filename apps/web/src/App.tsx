import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/features/auth/LoginPage';
import ChatLayout from '@/features/chat/ChatLayout';
import AdminLayout from '@/features/admin/AdminLayout';
import AdminUsersPage from '@/features/admin/pages/AdminUsersPage';
import AdminGroupsPage from '@/features/admin/pages/AdminGroupsPage';
import AdminAnnouncementsPage from '@/features/admin/pages/AdminAnnouncementsPage';
import AdminFilesPage from '@/features/admin/pages/AdminFilesPage';
import AdminSettingsPage from '@/features/admin/pages/AdminSettingsPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Giriş gerekli — Chat */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<ChatLayout />} />
      </Route>

      {/* Admin gerekli */}
      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="groups" element={<AdminGroupsPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
          <Route path="files" element={<AdminFilesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>

      {/* Bilinmeyen rotalar */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
