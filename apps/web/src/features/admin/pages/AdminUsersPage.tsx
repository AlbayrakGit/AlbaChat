import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Pencil, UserX, UserCheck, Eye, X } from 'lucide-react';

interface AdminUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  groups?: { id: number; name: string; type: string; member_role: string }[];
}

interface UserFormData {
  username: string;
  email: string;
  display_name: string;
  password: string;
  role: 'admin' | 'user';
}

// ─── Modal: CSV Import ─────────────────────────────────────────────────────────
interface CsvResult {
  created: number;
  skipped: number;
  errors: { line: number; username: string; reason: string }[];
}

function CsvImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvResult | null>(null);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleImport() {
    if (!file) { setError('Lütfen bir CSV dosyası seçin.'); return; }
    setError('');
    setIsPending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/admin/users/csv-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message: string } } } };
      setError(e.response?.data?.error?.message || 'Import başarısız.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">CSV ile Toplu Import</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            {/* Format açıklaması */}
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">CSV Format (ilk satır başlık):</p>
              <code className="text-xs text-blue-700 break-all">
                display_name,username,email,password,role<br />
                Ahmet Yılmaz,ahmetyilmaz,ahmet@sirket.com,sifre1234,user
              </code>
              <p className="mt-2 text-xs text-blue-600">role alanı opsiyonel (varsayılan: user). Maks. 500 satır, 1 MB.</p>
            </div>

            {/* Dosya seçici */}
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => document.getElementById('csv-file-input')?.click()}
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="text-sm text-gray-700">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-gray-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm">CSV dosyasını seçmek için tıklayın</p>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary">İptal</button>
              <button onClick={handleImport} disabled={isPending || !file} className="flex-1 btn-primary">
                {isPending ? 'Yükleniyor...' : 'Import Et'}
              </button>
            </div>
          </div>
        ) : (
          /* Sonuç ekranı */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-sm text-green-600 mt-1">Oluşturuldu</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
                <p className="text-sm text-yellow-600 mt-1">Atlandı</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-700 mb-2">Hatalar:</p>
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs text-red-600 mb-1">
                    <span className="font-medium">Satır {e.line} ({e.username}):</span> {e.reason}
                  </div>
                ))}
              </div>
            )}

            <button onClick={onClose} className="w-full btn-primary">Tamam</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal: Kullanıcı Oluştur ──────────────────────────────────────────────────
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<UserFormData>({
    username: '', email: '', display_name: '', password: '', role: 'user',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: UserFormData) => apiClient.post('/admin/users', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Bir hata oluştu.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.username || !form.email || !form.display_name || !form.password) {
      setError('Tüm alanlar zorunludur.');
      return;
    }
    if (form.password.length < 8) {
      setError('Şifre en az 8 karakter olmalı.');
      return;
    }
    mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Kullanıcı Oluştur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
              <input
                type="text" value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                className="input-field" placeholder="Ahmet Yılmaz"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kullanıcı Adı</label>
              <input
                type="text" value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="input-field" placeholder="ahmetyilmaz"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-posta</label>
            <input
              type="email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field" placeholder="ahmet@sirket.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Şifre</label>
            <input
              type="password" value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="input-field" placeholder="En az 8 karakter"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
              className="input-field"
            >
              <option value="user">Kullanıcı</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">İptal</button>
            <button type="submit" disabled={isPending} className="flex-1 btn-primary">
              {isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Kullanıcı Detay / Düzenle ─────────────────────────────────────────
function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const { data, isLoading } = useQuery<AdminUser>({
    queryKey: ['admin', 'users', userId],
    queryFn: () => apiClient.get(`/admin/users/${userId}`).then((r) => r.data.data),
  });

  const { mutate: toggleStatus, isPending: isToggling } = useMutation({
    mutationFn: (is_active: boolean) =>
      apiClient.patch(`/admin/users/${userId}/status`, { is_active }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId] });
    },
  });

  const { mutate: resetPassword, isPending: isResetting } = useMutation({
    mutationFn: (password: string) =>
      apiClient.patch(`/admin/users/${userId}/password`, { new_password: password }).then((r) => r.data),
    onSuccess: () => {
      setShowPasswordForm(false);
      setNewPassword('');
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setPwError(err.response?.data?.error?.message || 'Hata oluştu.');
    },
  });

  function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) { setPwError('En az 8 karakter gerekli.'); return; }
    resetPassword(newPassword);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Kullanıcı Detayı</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400">Yükleniyor...</div>
        ) : data ? (
          <div className="space-y-5">
            {/* Temel bilgiler */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                {data.display_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">{data.display_name}</p>
                <p className="text-sm text-gray-500">@{data.username}</p>
                <p className="text-sm text-gray-500">{data.email}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${data.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                {data.role === 'admin' ? 'Admin' : 'Kullanıcı'}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${data.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {data.is_active ? 'Aktif' : 'Devre Dışı'}
              </span>
            </div>

            {/* Üye olduğu gruplar */}
            {data.groups && data.groups.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Üye Olduğu Gruplar</p>
                <div className="space-y-1">
                  {data.groups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-gray-800">{g.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{g.type}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{g.member_role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Şifre sıfırlama */}
            {showPasswordForm ? (
              <form onSubmit={handlePasswordReset} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-yellow-800">Yeni Şifre Belirle</p>
                <input
                  type="password" value={newPassword} placeholder="En az 8 karakter"
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                />
                {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 btn-secondary text-sm py-1.5">İptal</button>
                  <button type="submit" disabled={isResetting} className="flex-1 btn-primary text-sm py-1.5">
                    {isResetting ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </form>
            ) : null}

            {/* Eylemler */}
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowPasswordForm((v) => !v)}
                className="btn-secondary text-sm flex-1"
              >
                Şifre Sıfırla
              </button>
              <button
                onClick={() => toggleStatus(!data.is_active)}
                disabled={isToggling}
                className={`text-sm flex-1 rounded-xl px-4 py-2 font-medium transition-colors ${data.is_active
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
              >
                {isToggling ? '...' : data.is_active ? 'Devre Dışı Bırak' : 'Aktifleştir'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Modal: Kullanıcı Düzenle ────────────────────────────────────────────────
function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    display_name: user.display_name,
    email: user.email,
    role: user.role as 'admin' | 'user',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: typeof form) => apiClient.patch(`/users/${user.id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Bir hata oluştu.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.display_name.trim() || !form.email.trim()) {
      setError('Ad soyad ve e-posta zorunludur.');
      return;
    }
    mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Kullanıcıyı Düzenle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
            <input
              type="text" value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">E-posta</label>
            <input
              type="email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
              className="input-field"
            >
              <option value="user">Kullanıcı</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">İptal</button>
            <button type="submit" disabled={isPending} className="flex-1 btn-primary">
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<{ id: number; activate: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(true);

  const { mutate: toggleUserStatus, isPending: isTogglingStatus } = useMutation({
    mutationFn: ({ userId, is_active }: { userId: number; is_active: boolean }) =>
      apiClient.patch(`/admin/users/${userId}/status`, { is_active }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setStatusConfirm(null);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, includeInactive],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        includeInactive: String(includeInactive),
        limit: '100',
      });
      const res = await apiClient.get(`/admin/users?${params}`);
      return res.data;
    },
    staleTime: 10 * 1000,
  });

  const users: AdminUser[] = data?.users || [];

  return (
    <div>
      {/* Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCsvImport(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
          >
            CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs sm:text-sm">
            + Yeni
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <input
          type="text" value={search} placeholder="İsim veya e-posta ara..."
          onChange={(e) => setSearch(e.target.value)}
          className="input-field sm:max-w-xs"
        />
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox" checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Pasif kullanıcıları göster
          </label>
          <span className="sm:ml-auto text-xs sm:text-sm text-gray-400">
            {users.length} kullanıcı
          </span>
        </div>
      </div>

      {/* Tablo */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Yükleniyor...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Kullanıcı bulunamadı.</div>
        ) : (
          <>
            {/* Desktop: Tablo */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Kullanıcı</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">E-posta</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Durum</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Kayıt</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{user.display_name}</div>
                        <div className="text-gray-400 text-xs">@{user.username}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                          {user.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelectedUserId(user.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Detay">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingUser(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Düzenle">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {user.is_active ? (
                            <button onClick={() => setStatusConfirm({ id: user.id, activate: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Devre Dışı Bırak">
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => setStatusConfirm({ id: user.id, activate: true })} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Aktifleştir">
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil: Kart görünümü */}
            <div className="md:hidden divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className={`p-3 ${!user.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 truncate">{user.display_name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${user.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">@{user.username} · {user.email}</p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                      <button onClick={() => setSelectedUserId(user.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingUser(user)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {user.is_active ? (
                        <button onClick={() => setStatusConfirm({ id: user.id, activate: false })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500">
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => setStatusConfirm({ id: user.id, activate: true })} className="p-1.5 rounded-lg text-gray-400 hover:text-green-500">
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Durum değiştirme onay */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {statusConfirm.activate ? 'Kullanıcıyı Aktifleştir' : 'Kullanıcıyı Devre Dışı Bırak'}
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              {statusConfirm.activate
                ? 'Bu kullanıcı tekrar sisteme giriş yapabilecek.'
                : 'Bu kullanıcı sisteme giriş yapamayacak ve tüm aktif oturumları sonlandırılacak.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStatusConfirm(null)} className="flex-1 btn-secondary">
                İptal
              </button>
              <button
                onClick={() => toggleUserStatus({ userId: statusConfirm.id, is_active: statusConfirm.activate })}
                disabled={isTogglingStatus}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${statusConfirm.activate
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                  } disabled:opacity-50`}
              >
                {isTogglingStatus ? '...' : statusConfirm.activate ? 'Aktifleştir' : 'Devre Dışı Bırak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modaller */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {showCsvImport && (
        <CsvImportModal
          onClose={() => setShowCsvImport(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })}
        />
      )}
      {selectedUserId !== null && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}
