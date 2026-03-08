import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/store/authStore';
import { MessageSquare, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await apiClient.post('/auth/login', { username, password });
      setAuth(data.data.access_token, data.data.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      setError(msg || 'Giriş başarısız. Bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm px-6">

        {/* Logo & Başlık */}
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AlbaChat</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kurumsal Mesajlaşma Platformu</p>
        </div>

        {/* Giriş Kartı */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Kullanıcı Adı */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                className="input-field h-11"
                placeholder="Kullanıcı adınızı girin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Şifre
              </label>
              <input
                type="password"
                className="input-field h-11"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {/* Hata Mesajı */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Giriş Butonu */}
            <button
              type="submit"
              className="btn-primary w-full h-11 text-sm font-semibold mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Giriş yapılıyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Giriş Yap
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>

          </form>
        </div>

        {/* Alt Bilgi */}
        <div className="text-center mt-6 space-y-3">
          <p className="text-xs text-gray-400">
            AlbaChat v2.0
          </p>

          {!window.electronAPI && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-center">
              <a
                href="/download/AlbaChat-Setup.exe"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-semibold transition-all active:scale-95"
              >
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                Desktop Uygulamasını İndir
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
