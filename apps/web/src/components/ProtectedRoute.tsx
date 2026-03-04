import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/api/client';

interface Props {
  requiredRole?: 'admin';
}

/**
 * Korumalı rota. Kullanıcı oturumu yoksa /login'e yönlendirir.
 * Sayfa yenilendiğinde, eğer accessToken expire olmuşsa
 * önce /auth/refresh ile yeni token almayı dener.
 */
export default function ProtectedRoute({ requiredRole }: Props) {
  const { isAuthenticated, user, accessToken, setAuth, logout } = useAuthStore();
  const [checking, setChecking] = useState(!accessToken && isAuthenticated);

  useEffect(() => {
    // Eğer isAuthenticated ama accessToken yok (eski persist formatı)
    // veya accessToken var ama expire olmuş olabilir — refresh dene
    if (!accessToken && isAuthenticated) {
      apiClient.post('/auth/refresh', {})
        .then(({ data }) => {
          const newToken = data.data.access_token;
          if (user) {
            setAuth(newToken, user);
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setChecking(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh token denemesi devam ederken loading göster
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400 font-medium">Oturum doğrulanıyor...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
