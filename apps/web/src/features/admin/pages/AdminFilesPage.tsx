import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Depolama İstatistikleri ───────────────────────────────────────────────────

interface Stats {
  active: { file_count: number; total_bytes: number };
  deleted: { file_count: number; total_bytes: number };
  by_type: { mime_type: string; size_bytes: number; file_count: number }[];
  by_group: { group_id: number; group_name: string; size_bytes: number; file_count: number }[];
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function StorageStats() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['admin', 'files', 'stats'],
    queryFn: () => apiClient.get('/admin/files/stats').then((r) => r.data.data),
    staleTime: 30 * 1000,
  });

  if (isLoading) return <div className="card p-6 text-center text-gray-400">Yükleniyor...</div>;
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Toplam Dosya" value={stats.active.file_count.toLocaleString()} sub={formatBytes(stats.active.total_bytes)} />
        <StatCard label="Toplam Boyut" value={formatBytes(stats.active.total_bytes)} />
        <StatCard label="Silinmiş (Grace)" value={stats.deleted.file_count.toLocaleString()} sub={formatBytes(stats.deleted.total_bytes)} />
        <StatCard label="Silinmiş Boyut" value={formatBytes(stats.deleted.total_bytes)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Türe göre */}
        <div className="card p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Türe Göre Dağılım</p>
          <div className="space-y-2">
            {stats.by_type.slice(0, 6).map((t) => (
              <div key={t.mime_type} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate max-w-[60%]">{t.mime_type.split('/')[1] || t.mime_type}</span>
                <div className="text-right">
                  <span className="text-gray-900 font-medium">{formatBytes(t.size_bytes)}</span>
                  <span className="text-gray-400 ml-2">({t.file_count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gruba göre */}
        <div className="card p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Gruba Göre Dağılım</p>
          <div className="space-y-2">
            {stats.by_group.slice(0, 6).map((g) => (
              <div key={g.group_id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate max-w-[60%]">{g.group_name}</span>
                <div className="text-right">
                  <span className="text-gray-900 font-medium">{formatBytes(g.size_bytes)}</span>
                  <span className="text-gray-400 ml-2">({g.file_count})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dosya Listesi ─────────────────────────────────────────────────────────────

interface FileItem {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  group_id: number;
  group_name: string;
  uploader_username: string;
  uploader_display_name: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
}

function BulkDeleteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ groupId: '', mimeType: '', olderThanDays: '' });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (body: object) => apiClient.delete('/admin/files/bulk', { data: body }).then((r) => r.data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Hata oluştu.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const body: Record<string, unknown> = {};
    if (form.groupId) body.groupId = parseInt(form.groupId);
    if (form.mimeType) body.mimeType = form.mimeType;
    if (form.olderThanDays) body.olderThanDays = parseInt(form.olderThanDays);
    if (!Object.keys(body).length) { setError('En az bir filtre belirtilmeli.'); return; }
    mutate(body);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Toplu Silme</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Kriterlere uyan dosyalar soft-delete yapılır. 24 saat sonra MinIO'dan kalıcı olarak silinir.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grup ID (opsiyonel)</label>
            <input type="number" value={form.groupId} onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))} className="input-field" placeholder="Boş = tüm gruplar" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">MIME Türü (opsiyonel)</label>
            <input type="text" value={form.mimeType} onChange={(e) => setForm((f) => ({ ...f, mimeType: e.target.value }))} className="input-field" placeholder="Örn: image/ veya application/pdf" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">N günden eski (opsiyonel)</label>
            <input type="number" value={form.olderThanDays} onChange={(e) => setForm((f) => ({ ...f, olderThanDays: e.target.value }))} className="input-field" placeholder="Örn: 90" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">İptal</button>
            <button type="submit" disabled={isPending} className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2 font-medium hover:bg-red-700 transition-colors">
              {isPending ? 'Siliniyor...' : 'Toplu Sil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FileList() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'files', 'list', page, showDeleted],
    queryFn: () =>
      apiClient.get(`/admin/files/list?page=${page}&limit=50&showDeleted=${showDeleted}`).then((r) => r.data),
    staleTime: 15 * 1000,
  });

  const files: FileItem[] = data?.data || [];
  const total: number = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const { mutate: restore } = useMutation({
    mutationFn: (id: number) => apiClient.post(`/admin/files/${id}/restore`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'files'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setPage(1); }} className="w-4 h-4 rounded" />
          Silinmişleri göster
        </label>
        <span className="ml-auto text-sm text-gray-400">{total} dosya</span>
        <button onClick={() => setShowBulkModal(true)} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
          Toplu Sil
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Yükleniyor...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Dosya bulunamadı.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Dosya</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Grup</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Yükleyen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Boyut</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tarih</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((f) => (
                <tr key={f.id} className={`hover:bg-gray-50 ${f.is_deleted ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">{f.original_name}</p>
                    <p className="text-xs text-gray-400">{f.mime_type}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.group_name}</td>
                  <td className="px-4 py-3 text-gray-600">{f.uploader_display_name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatBytes(f.size_bytes)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {f.is_deleted && f.deleted_at ? (
                      <button onClick={() => restore(f.id)} className="text-green-600 hover:text-green-800 text-xs font-medium">
                        Geri Al
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">
            ‹ Önceki
          </button>
          <span className="text-sm text-gray-500 self-center">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40">
            Sonraki ›
          </button>
        </div>
      )}

      {showBulkModal && (
        <BulkDeleteModal
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin', 'files'] })}
        />
      )}
    </div>
  );
}

// ─── Temizleme Politikaları ────────────────────────────────────────────────────

interface Policy {
  id: number;
  name: string;
  max_age_days: number | null;
  max_size_mb: number | null;
  scope: 'global' | 'group';
  group_id: number | null;
  group_name: string | null;
  mime_type_filter: string | null;
  action: 'delete' | 'archive';
  cron_expression: string;
  is_active: boolean;
  last_run_at: string | null;
}

function PolicyForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '',
    max_age_days: '',
    max_size_mb: '',
    scope: 'global',
    mime_type_filter: '',
    action: 'delete',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: object) => apiClient.post('/admin/cleanup-policies', data).then((r) => r.data),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Hata oluştu.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const body: Record<string, unknown> = { name: form.name, scope: form.scope, action: form.action };
    if (form.max_age_days) body.max_age_days = parseInt(form.max_age_days);
    if (form.max_size_mb) body.max_size_mb = parseInt(form.max_size_mb);
    if (form.mime_type_filter) body.mime_type_filter = form.mime_type_filter;
    mutate(body);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Temizleme Politikası</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Politika Adı</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Örn: 90 günden eski görseller" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Yaş (gün)</label>
              <input type="number" value={form.max_age_days} onChange={(e) => setForm((f) => ({ ...f, max_age_days: e.target.value }))} className="input-field" placeholder="Örn: 90" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Boyut (MB)</label>
              <input type="number" value={form.max_size_mb} onChange={(e) => setForm((f) => ({ ...f, max_size_mb: e.target.value }))} className="input-field" placeholder="Örn: 100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">MIME Türü Filtresi (opsiyonel)</label>
            <input type="text" value={form.mime_type_filter} onChange={(e) => setForm((f) => ({ ...f, mime_type_filter: e.target.value }))} className="input-field" placeholder="image/jpeg,video/mp4" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kapsam</label>
              <select value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} className="input-field">
                <option value="global">Global</option>
                <option value="group">Grup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Eylem</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} className="input-field">
                <option value="delete">Sil</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">İptal</button>
            <button type="submit" disabled={isPending} className="flex-1 btn-primary">
              {isPending ? 'Kaydediliyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CleanupPolicies() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [runResult, setRunResult] = useState<{ id: number; deleted: number; purged: number } | null>(null);

  const { data: policies = [], isLoading } = useQuery<Policy[]>({
    queryKey: ['admin', 'cleanup-policies'],
    queryFn: () => apiClient.get('/admin/cleanup-policies').then((r) => r.data.data),
    staleTime: 30 * 1000,
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      apiClient.patch(`/admin/cleanup-policies/${id}`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cleanup-policies'] }),
  });

  const { mutate: runNow, isPending: isRunning, variables: runningId } = useMutation({
    mutationFn: (id: number) => apiClient.post(`/admin/cleanup-policies/${id}/run`).then((r) => r.data.data),
    onSuccess: (data, id) => {
      qc.invalidateQueries({ queryKey: ['admin', 'cleanup-policies'] });
      qc.invalidateQueries({ queryKey: ['admin', 'files'] });
      setRunResult({ id, ...data });
    },
  });

  const { mutate: deletePolicy } = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/admin/cleanup-policies/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'cleanup-policies'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">Otomatik temizleme kuralları — her gece 02:00 çalışır</p>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Yeni Politika</button>
      </div>

      {runResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-center justify-between">
          <span>Politika #{runResult.id} çalıştı: {runResult.deleted} dosya silindi, {runResult.purged} MinIO'dan kaldırıldı.</span>
          <button onClick={() => setRunResult(null)} className="text-green-600 hover:text-green-800 ml-4">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="card p-8 text-center text-gray-400">Yükleniyor...</div>
      ) : policies.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">Temizleme politikası yok.</div>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className={`card p-4 ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    {p.max_age_days && <span>{p.max_age_days} günden eski</span>}
                    {p.max_size_mb && <span>{p.max_size_mb} MB üzeri</span>}
                    {p.mime_type_filter && <span>{p.mime_type_filter}</span>}
                    <span className={p.scope === 'global' ? 'text-blue-600' : 'text-purple-600'}>
                      {p.scope === 'global' ? 'Global' : `Grup: ${p.group_name || p.group_id}`}
                    </span>
                  </div>
                  {p.last_run_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Son çalışma: {formatDate(p.last_run_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive({ id: p.id, is_active: !p.is_active })}
                    className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {p.is_active ? 'Aktif' : 'Pasif'}
                  </button>
                  <button
                    onClick={() => runNow(p.id)}
                    disabled={isRunning && runningId === p.id}
                    className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    {isRunning && runningId === p.id ? '...' : 'Çalıştır'}
                  </button>
                  <button
                    onClick={() => deletePolicy(p.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PolicyForm
          onClose={() => setShowForm(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['admin', 'cleanup-policies'] })}
        />
      )}
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────

type Tab = 'stats' | 'files' | 'policies';

export default function AdminFilesPage() {
  const [tab, setTab] = useState<Tab>('stats');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'İstatistikler' },
    { key: 'files', label: 'Dosya Listesi' },
    { key: 'policies', label: 'Temizleme Politikaları' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dosya Yönetimi</h1>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StorageStats />}
      {tab === 'files' && <FileList />}
      {tab === 'policies' && <CleanupPolicies />}
    </div>
  );
}
