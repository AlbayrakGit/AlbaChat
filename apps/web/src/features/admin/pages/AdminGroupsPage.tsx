import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { Pencil, Trash2, Archive, X, Users } from 'lucide-react';

interface AdminGroup {
  id: number;
  name: string;
  description: string | null;
  type: 'department' | 'private' | 'direct';
  department_code: string | null;
  is_archived: boolean;
  member_count: number;
  created_at: string;
}

interface GroupMember {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  member_role: string;
}

interface AllUser {
  id: number;
  username: string;
  display_name: string;
}

// ─── Modal: Grup Oluştur ──────────────────────────────────────────────────────
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'private' as 'department' | 'private',
    department_code: '',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/groups', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Bir hata oluştu.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Grup adı zorunludur.'); return; }
    mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Yeni Grup Oluştur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grup Adı</label>
            <input
              type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field" placeholder="Örn: IT Departmanı"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama (opsiyonel)</label>
            <input
              type="text" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field" placeholder="Grup hakkında kısa bilgi"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tür</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'department' | 'private' }))}
              className="input-field"
            >
              <option value="private">Özel Grup</option>
              <option value="department">Departman Grubu</option>
            </select>
          </div>
          {form.type === 'department' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Departman Kodu</label>
              <input
                type="text" value={form.department_code}
                onChange={(e) => setForm((f) => ({ ...f, department_code: e.target.value }))}
                className="input-field" placeholder="Örn: IT, HR, FIN"
              />
            </div>
          )}

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

// ─── Modal: Grup Düzenle ──────────────────────────────────────────────────────
function EditGroupModal({ group, onClose }: { group: AdminGroup; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: group.name,
    description: group.description || '',
    type: group.type as 'department' | 'private',
    department_code: group.department_code || '',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (data: typeof form) => apiClient.patch(`/groups/${group.id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setError(err.response?.data?.error?.message || 'Bir hata oluştu.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Grup adı zorunludur.'); return; }
    mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Grubu Düzenle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Grup Adı</label>
            <input
              type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <input
              type="text" value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-field" placeholder="Grup hakkında kısa bilgi"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tür</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'department' | 'private' }))}
              className="input-field"
            >
              <option value="private">Özel Grup</option>
              <option value="department">Departman Grubu</option>
            </select>
          </div>
          {form.type === 'department' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Departman Kodu</label>
              <input
                type="text" value={form.department_code}
                onChange={(e) => setForm((f) => ({ ...f, department_code: e.target.value }))}
                className="input-field" placeholder="Örn: IT, HR, FIN"
              />
            </div>
          )}

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

// ─── Modal: Grup Detay ────────────────────────────────────────────────────────
function GroupDetailModal({ group, onClose }: { group: AdminGroup; onClose: () => void }) {
  const qc = useQueryClient();
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addError, setAddError] = useState('');

  const { data: members = [], isLoading } = useQuery<GroupMember[]>({
    queryKey: ['admin', 'groups', group.id, 'members'],
    queryFn: () => apiClient.get(`/admin/groups/${group.id}/members`).then((r) => r.data.data),
  });

  // Üye eklemek için tüm kullanıcılar
  const { data: allUsers = [] } = useQuery<AllUser[]>({
    queryKey: ['admin', 'users-flat'],
    queryFn: () => apiClient.get('/admin/users?limit=500').then((r) => r.data.users as AllUser[]),
    enabled: !group.is_archived && group.type !== 'direct',
  });

  const memberIds = new Set(members.map((m) => m.id));
  const addableUsers = allUsers.filter(
    (u) =>
      !memberIds.has(u.id) &&
      (addSearch === '' ||
        u.display_name.toLowerCase().includes(addSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(addSearch.toLowerCase())),
  );

  const { mutate: archiveGroup, isPending: isArchiving } = useMutation({
    mutationFn: () => apiClient.post(`/groups/${group.id}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] });
      onClose();
    },
  });

  const { mutate: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: (userId: number) =>
      apiClient.delete(`/admin/groups/${group.id}/members/${userId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups', group.id, 'members'] });
    },
  });

  const { mutate: addMember, isPending: isAdding } = useMutation({
    mutationFn: (userId: number) =>
      apiClient.post(`/admin/groups/${group.id}/members`, { user_id: userId }).then((r) => r.data),
    onSuccess: () => {
      setAddSearch('');
      setAddError('');
      qc.invalidateQueries({ queryKey: ['admin', 'groups', group.id, 'members'] });
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] });
    },
    onError: (err: { response?: { data?: { error?: { message: string } } } }) => {
      setAddError(err.response?.data?.error?.message || 'Üye eklenemedi.');
    },
  });

  const typeLabels = { department: 'Departman', private: 'Özel', direct: '1-1 DM' };
  const typeColors = {
    department: 'bg-blue-100 text-blue-700',
    private: 'bg-gray-100 text-gray-700',
    direct: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Grup Detayı</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grup bilgileri */}
        <div className="mb-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0">
              {group.name[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{group.name}</p>
              {group.description && <p className="text-sm text-gray-500">{group.description}</p>}
              <div className="flex gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[group.type]}`}>
                  {typeLabels[group.type]}
                </span>
                {group.department_code && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    {group.department_code}
                  </span>
                )}
                {group.is_archived && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    Arşivlendi
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mevcut üyeler */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Mevcut Üyeler ({isLoading ? '...' : members.length})
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="text-sm text-gray-400 py-4 text-center">Yükleniyor...</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">Üye yok</div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{m.display_name}</span>
                    <span className="text-xs text-gray-400 ml-2">@{m.username}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {m.member_role}
                    </span>
                    {m.member_role !== 'owner' && group.type !== 'direct' && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={isRemoving}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="Üyeyi çıkar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Üye ekleme (arşivli ve DM dışında) */}
        {!group.is_archived && group.type !== 'direct' && (
          <div className="mb-5 border border-blue-100 rounded-xl p-3 bg-blue-50/40">
            <p className="text-xs font-medium text-gray-600 mb-2">Üye Ekle</p>
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="İsim veya kullanıcı adı ara..."
              className="input-field text-sm mb-2"
            />
            {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {addableUsers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">
                  {addSearch ? 'Kullanıcı bulunamadı.' : 'Tüm kullanıcılar zaten üye.'}
                </p>
              ) : (
                addableUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-800">{u.display_name}</span>
                      <span className="text-xs text-gray-400 ml-2">@{u.username}</span>
                    </div>
                    <button
                      onClick={() => addMember(u.id)}
                      disabled={isAdding}
                      className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      Ekle
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Arşivleme */}
        {!group.is_archived && group.type !== 'direct' && (
          <div className="border-t border-gray-100 pt-4">
            {archiveConfirm ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm text-red-800">
                  Grubu arşivlemek istediğinizden emin misiniz? Arşivlenen gruba yeni mesaj gönderilemez.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setArchiveConfirm(false)} className="flex-1 btn-secondary text-sm py-1.5">
                    İptal
                  </button>
                  <button
                    onClick={() => archiveGroup()}
                    disabled={isArchiving}
                    className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                  >
                    {isArchiving ? 'Arşivleniyor...' : 'Arşivle'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setArchiveConfirm(true)}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Grubu Arşivle
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function AdminGroupsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AdminGroup | null>(null);
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [archiveConfirmId, setArchiveConfirmId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'department' | 'private'>('all');
  const [showArchived, setShowArchived] = useState(false);

  // /api/admin/groups — admin yetkisiyle TÜM grupları listeler
  const { data: groups = [], isLoading } = useQuery<AdminGroup[]>({
    queryKey: ['admin', 'groups'],
    queryFn: () => apiClient.get('/admin/groups').then((r) => r.data.data),
    staleTime: 15 * 1000,
  });

  // direct mesajları filtrele — yönetim ekranında gereksiz
  const filtered = groups.filter((g) => {
    if (g.type === 'direct') return false;
    if (!showArchived && g.is_archived) return false;
    if (filter !== 'all' && g.type !== filter) return false;
    return true;
  });

  const { mutate: archiveGroup, isPending: isArchiving } = useMutation({
    mutationFn: (groupId: number) => apiClient.post(`/groups/${groupId}/archive`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'groups'] });
      setArchiveConfirmId(null);
    },
  });

  const typeLabels: Record<string, string> = { department: 'Departman', private: 'Özel', all: 'Tümü' };
  const typeColors: Record<string, string> = {
    department: 'bg-blue-100 text-blue-700',
    private: 'bg-gray-100 text-gray-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grup Yönetimi</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + Yeni Grup
        </button>
      </div>

      {/* Filtreler */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {(['all', 'department', 'private'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {typeLabels[t]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Arşivlenenler
        </label>
        <span className="text-sm text-gray-400">{filtered.length} grup</span>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="card p-8 text-center text-gray-400">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">Grup bulunamadı.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((g) => (
            <div
              key={g.id}
              className={`card p-4 transition-shadow hover:shadow-md ${g.is_archived ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div
                  onClick={() => setSelectedGroup(g)}
                  className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold shrink-0 cursor-pointer"
                >
                  {g.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedGroup(g)}>
                  <p className="font-medium text-gray-900 truncate">{g.name}</p>
                  {g.description && <p className="text-xs text-gray-400 truncate">{g.description}</p>}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeColors[g.type] || 'bg-gray-100 text-gray-700'}`}>
                      {typeLabels[g.type] || g.type}
                    </span>
                    {g.department_code && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                        {g.department_code}
                      </span>
                    )}
                    {g.is_archived && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                        Arşiv
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 font-medium flex items-center gap-0.5">
                      <Users className="w-3 h-3" /> {g.member_count}
                    </span>
                  </div>
                </div>
                {/* Düzenle / Arşivle butonları */}
                {!g.is_archived && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingGroup(g); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Düzenle"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setArchiveConfirmId(g.id); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Arşivle"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Arşivleme onay */}
              {archiveConfirmId === g.id && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700 mb-2">Bu grubu arşivlemek istediğinizden emin misiniz?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setArchiveConfirmId(null)}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      İptal
                    </button>
                    <button
                      onClick={() => archiveGroup(g.id)}
                      disabled={isArchiving}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isArchiving ? 'Arşivleniyor...' : 'Arşivle'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {editingGroup && <EditGroupModal group={editingGroup} onClose={() => setEditingGroup(null)} />}
      {selectedGroup && <GroupDetailModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />}
    </div>
  );
}
