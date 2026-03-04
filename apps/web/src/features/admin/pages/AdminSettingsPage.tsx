import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

interface SystemSettings {
  app_name: string;
  app_logo_url: string;
  max_file_size_mb: string;
  allowed_file_types: string;
  timezone: string;
  session_timeout_hours: string;
  max_message_length: string;
  registration_enabled: string;
  nginx_port: string;
}

interface SaveMeta {
  nginx_reloaded?: boolean;
  nginx_restart_required?: boolean;
  nginx_error?: string;
}

function SettingsSection({ title, description, children }: {
  title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-48 shrink-0 pt-2">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveMeta, setSaveMeta] = useState<SaveMeta | null>(null);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiClient.get('/admin/settings').then((r) => r.data.data),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (settings && !form) {
      setForm(settings);
    }
  }, [settings, form]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: SystemSettings) =>
      apiClient.patch('/admin/settings', data).then((r) => r.data),
    onSuccess: (res) => {
      setForm(res.data);
      qc.setQueryData(['admin', 'settings'], res.data);
      setSaveMeta(res.meta ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form) mutate(form);
  }

  function update(key: keyof SystemSettings, value: string) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  if (isLoading || !form) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sistem Ayarları</h1>
        <div className="card p-8 text-center text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sistem Ayarları</h1>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Kaydedildi
          </span>
        )}
      </div>

      {/* Nginx durum bildirimleri */}
      {saved && saveMeta?.nginx_reloaded && (
        <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Nginx yapılandırması güncellendi ve yeniden yüklendi.
        </div>
      )}
      {saved && saveMeta?.nginx_restart_required && (
        <div className="mb-4 flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 text-sm text-yellow-800">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Port değişikliği için nginx yeniden başlatılmalı.</p>
            <p className="text-xs mt-0.5 font-mono text-yellow-700">
              docker compose -f infra/docker-compose.prod.yml up -d --force-recreate nginx
            </p>
          </div>
        </div>
      )}
      {saved && saveMeta?.nginx_error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Nginx reload hatası: {saveMeta.nginx_error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <SettingsSection
          title="Uygulama"
          description="Uygulamanın görünür adı ve marka ayarları"
        >
          <FieldRow label="Uygulama Adı" hint="Giriş ekranı ve başlıkta görünür">
            <input
              type="text" value={form.app_name}
              onChange={(e) => update('app_name', e.target.value)}
              className="input-field" placeholder="AlbaChat"
            />
          </FieldRow>
          <FieldRow label="Logo URL" hint="Boş bırakılırsa varsayılan logo kullanılır">
            <input
              type="text" value={form.app_logo_url}
              onChange={(e) => update('app_logo_url', e.target.value)}
              className="input-field" placeholder="https://..."
            />
          </FieldRow>
        </SettingsSection>

        <SettingsSection
          title="Dosya Yönetimi"
          description="Yükleme sınırları ve izin verilen dosya türleri"
        >
          <FieldRow label="Maks. Dosya Boyutu" hint="MB cinsinden">
            <div className="flex items-center gap-2">
              <input
                type="number" min="1" max="500" value={form.max_file_size_mb}
                onChange={(e) => update('max_file_size_mb', e.target.value)}
                className="input-field w-24"
              />
              <span className="text-sm text-gray-500">MB</span>
            </div>
          </FieldRow>
          <FieldRow label="İzin Verilen Uzantılar" hint="Virgülle ayırın">
            <input
              type="text" value={form.allowed_file_types}
              onChange={(e) => update('allowed_file_types', e.target.value)}
              className="input-field" placeholder="jpg,jpeg,png,pdf,docx"
            />
            <p className="text-xs text-gray-400 mt-1">
              Örn: <span className="bg-gray-100 px-1 rounded font-mono text-xs">jpg,png,pdf,docx,xlsx</span>
            </p>
          </FieldRow>
        </SettingsSection>

        <SettingsSection
          title="Oturum & Güvenlik"
          description="Kullanıcı oturumu ve mesaj sınırları"
        >
          <FieldRow label="Oturum Süresi" hint="Saat cinsinden (0 = sınırsız)">
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="720" value={form.session_timeout_hours}
                onChange={(e) => update('session_timeout_hours', e.target.value)}
                className="input-field w-24"
              />
              <span className="text-sm text-gray-500">saat</span>
            </div>
          </FieldRow>
          <FieldRow label="Maks. Mesaj Uzunluğu" hint="Karakter sayısı">
            <div className="flex items-center gap-2">
              <input
                type="number" min="100" max="10000" value={form.max_message_length}
                onChange={(e) => update('max_message_length', e.target.value)}
                className="input-field w-28"
              />
              <span className="text-sm text-gray-500">karakter</span>
            </div>
          </FieldRow>
        </SettingsSection>

        <SettingsSection
          title="Ağ & Sunucu"
          description="Nginx proxy portu — değişiklik sonrası nginx yeniden başlatılmalıdır"
        >
          <FieldRow
            label="Dış Port"
            hint="Kullanıcıların bağlandığı port (docker-compose APP_PORT)"
          >
            <div className="flex items-center gap-2">
              <input
                type="number" min="1" max="65535" value={form.nginx_port}
                onChange={(e) => update('nginx_port', e.target.value)}
                className="input-field w-28"
              />
              <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1">
                Değişiklik sonrası nginx restart gerekli
              </span>
            </div>
          </FieldRow>
        </SettingsSection>

        <SettingsSection
          title="Bölge & Saat Dilimi"
          description="Tarih/saat gösterimleri için saat dilimi"
        >
          <FieldRow label="Saat Dilimi" hint="IANA tz tanımlayıcısı">
            <select
              value={form.timezone}
              onChange={(e) => update('timezone', e.target.value)}
              className="input-field"
            >
              <option value="Europe/Istanbul">Europe/Istanbul (TR)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </FieldRow>
        </SettingsSection>

        <div className="flex justify-end">
          <button type="submit" disabled={isPending} className="btn-primary px-8">
            {isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
