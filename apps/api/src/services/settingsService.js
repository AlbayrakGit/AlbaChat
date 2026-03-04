import { knex } from '../db/knex.js';

// Varsayılan sistem ayarları
const DEFAULTS = {
  app_name: 'AlbaChat',
  app_logo_url: '',
  max_file_size_mb: '50',
  allowed_file_types: 'jpg,jpeg,png,gif,pdf,docx,xlsx,pptx,txt,zip',
  timezone: 'Europe/Istanbul',
  session_timeout_hours: '24',
  max_message_length: '4000',
  registration_enabled: 'false',
  nginx_port: '8080',        // dış port (docker-compose.prod.yml → APP_PORT)
};

export const ALLOWED_KEYS = Object.keys(DEFAULTS);

/**
 * Bu ayarların değişmesi nginx.conf'un yeniden üretilmesini tetikler.
 * (live reload — container restart gerekmez)
 */
export const NGINX_RELOAD_KEYS = ['max_file_size_mb'];

/**
 * Bu ayarların değişmesi nginx container'ının yeniden başlatılmasını gerektirir.
 * (port mapping yalnızca docker compose restart ile değişir)
 */
export const NGINX_RESTART_KEYS = ['nginx_port'];

/**
 * Tüm ayarları döndür (varsayılanlarla birleştirilmiş)
 */
export async function getAllSettings() {
  const rows = await knex('system_settings').select('key', 'value', 'updated_at');
  const result = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

/**
 * Toplu güncelleme — sadece izinli anahtarlar
 */
export async function updateSettings(updates, actorId) {
  const entries = Object.entries(updates).filter(([key]) => ALLOWED_KEYS.includes(key));
  if (entries.length === 0) return getAllSettings();

  for (const [key, value] of entries) {
    await knex('system_settings')
      .insert({ key, value: String(value), updated_by: actorId, updated_at: new Date() })
      .onConflict('key')
      .merge(['value', 'updated_by', 'updated_at']);
  }

  return getAllSettings();
}

/**
 * Tek bir ayarın değerini oku (yoksa default döner)
 */
export async function getSetting(key) {
  const row = await knex('system_settings').where({ key }).first('value');
  return row?.value ?? DEFAULTS[key] ?? null;
}
