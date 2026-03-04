import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Konfigürasyonu
 *
 * Testleri çalıştırmadan önce:
 *   1. Docker servisleri: docker compose -f infra/docker-compose.yml up -d
 *   2. API: npm run dev -w apps/api
 *   3. Web: npm run dev -w apps/web   (veya preview için: build + preview)
 *
 * Çalıştırma:
 *   npm run test:e2e -w apps/web
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Sıralı çalış (DB state paylaşımlı)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Lokal self-signed sertifikayı kabul et
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  // Testler başlamadan önce web sunucusunu başlat (CI)
  webServer: process.env.CI
    ? {
        command: 'npm run preview',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
