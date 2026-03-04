# AlbaChat — On-Premise Kurumsal Mesajlaşma

Kurumsal lokal ağda çalışan, internet bağımsız anlık mesajlaşma platformu.
WhatsApp/Mattermost referanslı, v1.0 kapsamı: mesajlaşma + duyuru + dosya paylaşımı + Electron desktop uygulaması.

---

## Hızlı Kurulum (Docker)

### Gereksinimler
- Docker 24+ ve Docker Compose
- 2 GB RAM, 20 GB disk (minimum)
- Node.js 20 LTS (sadece ilk build için)

### 1. Repo'yu Klonla

```bash
git clone <repo-url> AlbaChat
cd AlbaChat
npm install
```

### 2. Ortam Değişkenleri

```bash
cp .env.example .env
```

`.env` dosyasını düzenle — **zorunlu** alanlar:

| Değişken | Açıklama |
|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL şifresi |
| `REDIS_PASSWORD` | Redis şifresi |
| `MINIO_ROOT_USER` | MinIO kullanıcı adı |
| `MINIO_ROOT_PASSWORD` | MinIO şifresi (min 8 karakter) |
| `JWT_SECRET` | JWT access token imzalama anahtarı (min 32 karakter) |
| `REFRESH_SECRET` | Refresh token anahtarı (min 32 karakter) |

**Güvenli anahtar üretimi:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**VAPID (Web Push — opsiyonel):**
```bash
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2));"
```

### 3. Web Arayüzü Build Et

```bash
npm run build -w apps/web
```

### 4. Servisleri Başlat

```bash
docker compose -f infra/docker-compose.prod.yml up -d
```

Servis durumunu kontrol et:
```bash
docker compose -f infra/docker-compose.prod.yml ps
docker compose -f infra/docker-compose.prod.yml logs api --tail=50
```

### 5. Veritabanı Migrasyonu

Migration, API container başladığında otomatik çalışır.
Manuel çalıştırma:
```bash
docker compose -f infra/docker-compose.prod.yml exec api node src/db/migrate.js
```

### 6. İlk Admin Kullanıcısı

```bash
docker compose -f infra/docker-compose.prod.yml exec api node src/db/seed.js
```

Varsayılan: `admin` / `admin123` — **ilk girişten sonra şifre değiştirin!**

### 7. Erişim

| Servis | URL |
|---|---|
| Web Arayüzü | `http://<sunucu-ip>:8080` |
| API | `http://<sunucu-ip>:3001` |
| MinIO Console | `http://<sunucu-ip>:9001` |

---

## Geliştirme Ortamı

```bash
# Altyapı servisleri (PostgreSQL, Redis, MinIO)
docker compose -f infra/docker-compose.yml up -d

# API + Web birlikte
npm run dev
```

---

## Electron Desktop Uygulaması (.exe)

```bash
cd apps/desktop
npm install
npm run build   # AlbaChat-Setup-1.0.0.exe üretilir
```

Kurulum dosyası: `apps/desktop/dist/AlbaChat-Setup-1.0.0.exe`

**İlk Çalıştırma:** Uygulama sunucu URL'sini sorar. Örnek: `http://192.168.1.100:8080`

### Otomatik Güncelleme (electron-updater)

`apps/desktop/electron-builder.yml` dosyasında `url` alanını güncelleyecek dosya sunucunuzun adresine ayarlayın:

```yaml
publish:
  provider: generic
  url: http://192.168.1.100/AlbaChat-updates
```

Yeni sürüm `.exe` + `latest.yml` dosyasını o URL altına koyun.

---

## E2E Testler (Playwright)

```bash
cd apps/web
# Test ortam değişkenleri
export E2E_ADMIN_USER=admin
export E2E_ADMIN_PASS=admin123
export PLAYWRIGHT_BASE_URL=http://localhost:5173

# Tarayıcıları indir (ilk seferinde)
npx playwright install chromium

# Testleri çalıştır
npm run test:e2e
```

---

## Load Test

```bash
# Autocannon ile 100 eş zamanlı kullanıcı, 30 saniye
TEST_USER=admin TEST_PASS=admin123 npm run loadtest
```

---

## Proje Yapısı

```
AlbaChat/
├── apps/
│   ├── api/          → Node.js + Fastify backend (port 3001)
│   ├── web/          → React + TypeScript PWA
│   └── desktop/      → Electron Windows uygulaması
├── packages/
│   └── shared-types/ → Ortak TypeScript tipleri
├── infra/
│   ├── docker-compose.yml       → Geliştirme ortamı
│   ├── docker-compose.prod.yml  → Üretim ortamı
│   └── nginx/nginx.conf
├── scripts/
│   └── loadtest.js   → Autocannon yük testi
└── .env.example
```

---

## Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Backend | Node.js 20 + Fastify 4 + Socket.IO 4 |
| Veritabanı | PostgreSQL 16 + Knex.js |
| Cache | Redis 7 + ioredis |
| Dosya | MinIO (S3 uyumlu) |
| Frontend | React 19 + TypeScript + Tailwind CSS 4 |
| State | Zustand 5 + TanStack Query 5 |
| Desktop | Electron 28 + electron-builder |
| PWA | vite-plugin-pwa + Workbox |
| Güvenlik | JWT RS256 + bcrypt + DOMPurify + helmet |
| Proxy | Nginx 1.25 |

---

## Güvenlik Notları

- JWT access token süresi: 15 dakika
- Refresh token: 7 gün, httpOnly cookie, SameSite=Strict
- Rate limit: login 5/dk, API 100/dk, upload 10/dk
- Dosya doğrulama: MIME type + magic bytes + whitelist
- Tüm admin işlemleri `audit_logs` tablosuna kaydedilir
- Web Push için HTTPS gereklidir → bkz. [Sertifika Rehberi](docs/ssl-setup.md)

---

## Sorun Giderme

**Servisler başlamıyor:**
```bash
docker compose -f infra/docker-compose.prod.yml logs
```

**Veritabanı bağlantı hatası:**
```bash
docker compose -f infra/docker-compose.prod.yml exec postgres pg_isready
```

**MinIO bucket oluşturulmuyor:**
API loglarında `[MinIO]` ile başlayan satırları kontrol edin. `MINIO_ROOT_USER` ve `MINIO_ROOT_PASSWORD` `.env`'de doğru tanımlanmalı.

**Socket.IO bağlantı hatası:**
`nginx.conf`'taki `proxy_read_timeout 86400s` değerinin mevcut olduğunu kontrol edin.
