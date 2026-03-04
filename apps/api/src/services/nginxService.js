/**
 * nginxService — Nginx konfigürasyon yönetimi
 *
 * Admin panelinden değiştirilen ayarlar (maks. dosya boyutu vb.) nginx'e
 * otomatik uygulanır. Süreç:
 *   1. conf.d/dynamic.conf dosyası yazılır (API container → paylaşımlı volume)
 *   2. Docker socket üzerinden nginx -s reload komutu çalıştırılır
 *
 * Docker Compose gereksinimleri (docker-compose.prod.yml):
 *   - API service: volumes → nginx_confd:/etc/nginx/conf.d
 *   - API service: volumes → /var/run/docker.sock:/var/run/docker.sock:ro
 *   - nginx service: volumes → nginx_confd:/etc/nginx/conf.d
 */
import { writeFile, mkdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

// Paylaşımlı conf.d dizini — docker-compose.prod.yml'de nginx_confd volume olarak tanımlanmalı
const CONFD_DIR = process.env.NGINX_CONFD_DIR || '/etc/nginx/conf.d';
const DYNAMIC_CONF = path.join(CONFD_DIR, 'dynamic.conf');

// nginx container adı — docker exec için
const NGINX_CONTAINER = process.env.NGINX_CONTAINER || 'albachat-nginx';

/**
 * Ayarlardan conf.d/dynamic.conf içeriği üretir.
 * Sadece nginx.conf varsayılanlarını ezmek istediğimiz direktifler buraya yazılır.
 */
function buildDynamicConf({ maxFileSizeMb = 50 } = {}) {
  // +10% buffer: kullanıcı 50 MB ayarlarsa nginx 55 MB'a kadar kabul eder
  const maxBody = `${Math.ceil(Number(maxFileSizeMb) * 1.1)}M`;

  return [
    '# albachat — dinamik nginx direktifleri',
    '# Bu dosya Admin Paneli tarafından otomatik üretilir. Düzenlemeyin.',
    `# Son güncelleme: ${new Date().toISOString()}`,
    '',
    `client_max_body_size ${maxBody};`,
    '',
  ].join('\n');
}

/**
 * nginx conf.d/dynamic.conf dosyasını yaz ve nginx'i reload et.
 *
 * @param {{ max_file_size_mb?: string|number }} settings - system_settings değerleri
 * @returns {{ success: boolean, stage?: string, error?: string }}
 */
export async function reloadNginxConfig(settings = {}) {
  // conf.d dizinini oluştur (ilk çalıştırmada yoksa)
  try {
    await mkdir(CONFD_DIR, { recursive: true });
  } catch {
    // dizin zaten mevcutsa hata yok
  }

  // 1. Config dosyasını yaz
  try {
    const content = buildDynamicConf({
      maxFileSizeMb: settings.max_file_size_mb ?? 50,
    });
    await writeFile(DYNAMIC_CONF, content, 'utf8');
  } catch (err) {
    return { success: false, stage: 'write', error: err.message };
  }

  // 2. nginx reload (Docker socket üzerinden)
  try {
    await execFileAsync('docker', [
      'exec', NGINX_CONTAINER, 'nginx', '-s', 'reload',
    ]);
    return { success: true };
  } catch (err) {
    // Docker socket bağlantısı yoksa (örn. geliştirme ortamı) — uyarı ver ama hata fırlatma
    const msg = err.message || String(err);
    if (msg.includes('Cannot connect') || msg.includes('No such file') || msg.includes('permission denied')) {
      return { success: false, stage: 'reload', error: 'Docker socket erişimi yok — geliştirme ortamında normal.', devMode: true };
    }
    return { success: false, stage: 'reload', error: msg };
  }
}

/**
 * Nginx yapılandırmasını test et (nginx -t).
 * @returns {{ valid: boolean, output?: string }}
 */
export async function testNginxConfig() {
  try {
    const { stdout, stderr } = await execFileAsync('docker', [
      'exec', NGINX_CONTAINER, 'nginx', '-t',
    ]);
    return { valid: true, output: (stdout + stderr).trim() };
  } catch (err) {
    return { valid: false, output: err.message };
  }
}
