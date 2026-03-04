/**
 * E2E Test: Global Duyuru → Pop-up → Okundu
 * Sprint 14 — UAT
 */
import { test, expect } from '@playwright/test';
import { login, getApiToken, TEST_ADMIN } from './helpers';

test.describe('Duyuru Sistemi', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await getApiToken(request);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('admin duyuru oluşturabilir', async ({ page }) => {
    await page.goto('/admin/announcements');

    // Yeni duyuru butonu
    await page.getByRole('button', { name: /yeni duyuru/i }).click();

    const title = `Test Duyurusu — ${Date.now()}`;
    await page.getByLabel(/başlık/i).fill(title);
    await page.getByLabel(/içerik/i).fill('Bu bir E2E test duyurusudur.');

    await page.getByRole('button', { name: /gönder|yayınla/i }).click();

    await expect(page.getByText(title)).toBeVisible({ timeout: 5_000 });
  });

  test('yeni duyuru gelince modal açılır', async ({ page, request }) => {
    // Kullanıcı chat sayfasında oturum açık
    // Admin token ile API üzerinden duyuru oluştur
    const title = `Pop-up Test — ${Date.now()}`;
    const res = await request.post('/api/announcements', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title,
        content: 'E2E test için otomatik oluşturulan duyuru.',
        scope: 'global',
        priority: 'normal',
      },
    });
    expect(res.ok()).toBeTruthy();

    // Modal görünmeli (Socket.IO ile gerçek zamanlı)
    await expect(page.getByText(title)).toBeVisible({ timeout: 8_000 });
    // "Okudum, Anladım" butonu modal üzerinde olmalı
    await expect(page.getByRole('button', { name: /okudum/i })).toBeVisible({ timeout: 5_000 });
  });

  test('"Okudum, Anladım" butonuna basınca modal kapanır', async ({ page, request }) => {
    const title = `Okundu Test — ${Date.now()}`;
    await request.post('/api/announcements', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title,
        content: 'Okundu testi.',
        scope: 'global',
        priority: 'normal',
      },
    });

    // Modal görünmeli
    const readBtn = page.getByRole('button', { name: /okudum/i });
    await expect(readBtn).toBeVisible({ timeout: 8_000 });

    // Oku
    await readBtn.click();

    // Modal kapanmalı
    await expect(readBtn).not.toBeVisible({ timeout: 5_000 });
  });

  test('acil duyuru overlay kırmızı arka plan gösterir', async ({ page, request }) => {
    const title = `ACİL TEST — ${Date.now()}`;
    await request.post('/api/announcements', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title,
        content: 'Acil durum testi.',
        scope: 'global',
        priority: 'urgent',
      },
    });

    // Kırmızı overlay görünmeli
    await expect(page.locator('.bg-red-900\\/80, [class*="bg-red-900"]')).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByText(/acil duyuru/i)).toBeVisible();
  });

  test('duyuru arşivinde geçmiş duyurular görünür', async ({ page }) => {
    // Duyuru badge ikonuna tıkla
    await page.locator('[data-testid="announcement-badge"]').click();

    // Arşiv açılmalı
    await expect(page.getByText(/duyuru arşivi/i)).toBeVisible({ timeout: 5_000 });
  });
});
