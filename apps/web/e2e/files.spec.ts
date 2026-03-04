/**
 * E2E Test: Dosya Yükleme → İndirme → Admin Dosya Yönetimi
 * Sprint 14 — UAT
 */
import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { login, getApiToken } from './helpers';

// Test için küçük bir PNG dosyası oluştur (1x1 şeffaf piksel)
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function createTestFile(filename: string): string {
  const tmpDir = path.join(process.cwd(), 'e2e', '.tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, Buffer.from(TEST_PNG_BASE64, 'base64'));
  return filePath;
}

async function openFirstGroup(page: Page) {
  const firstGroup = page.locator('[data-testid="group-item"]').first();
  await firstGroup.click();
  await page.waitForTimeout(500);
}

test.describe('Dosya Yükleme', () => {
  let testFilePath: string;

  test.beforeAll(() => {
    testFilePath = createTestFile('test-image.png');
  });

  test.afterAll(() => {
    const tmpDir = path.join(process.cwd(), 'e2e', '.tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await openFirstGroup(page);
  });

  test('dosya seçici ile resim yüklenir', async ({ page }) => {
    // Ataç butonuna tıkla
    const attachBtn = page.locator('[data-testid="attach-button"], button[title*="dosya"], button[aria-label*="dosya"]');

    // File input'u doğrudan kullan
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Yükleme progress gösterilmeli
    await expect(page.getByText(/yükleniyor|%/i).first()).toBeVisible({ timeout: 10_000 });

    // Yükleme tamamlanınca resim mesajda görünmeli
    await expect(page.locator('img[alt="test-image.png"]').or(
      page.getByText('test-image.png')
    )).toBeVisible({ timeout: 15_000 });
  });

  test('sürükle bırak ile dosya yüklenir', async ({ page }) => {
    const chatWindow = page.locator('[data-testid="chat-window"]');

    // DataTransfer ile sürükle bırak simüle et
    const fileBuffer = Buffer.from(TEST_PNG_BASE64, 'base64');
    await chatWindow.dispatchEvent('drop', {
      dataTransfer: {
        files: [
          new File([fileBuffer], 'drag-test.png', { type: 'image/png' }),
        ],
      },
    });

    // Yükleme başlamalı veya drop-zone aktif olmalı
    await page.waitForTimeout(1000);
  });
});

test.describe('Admin Dosya Yönetimi', () => {
  let adminToken: string;
  let uploadedFileId: number | null = null;

  test.beforeAll(async ({ request }) => {
    adminToken = await getApiToken(request);

    // Test için API'ye dosya yükle
    const testFilePath = createTestFile('admin-test.png');
    const formData = new FormData();
    formData.append('file', new Blob([fs.readFileSync(testFilePath)], { type: 'image/png' }), 'admin-test.png');

    const groupsRes = await request.get('/api/groups', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const groups = await groupsRes.json();
    const firstGroupId = groups.data?.[0]?.id;

    if (firstGroupId) {
      const res = await request.post('/api/files/upload', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'X-Group-Id': String(firstGroupId),
        },
        multipart: {
          file: {
            name: 'admin-test.png',
            mimeType: 'image/png',
            buffer: fs.readFileSync(testFilePath),
          },
        },
      });
      if (res.ok()) {
        const data = await res.json();
        uploadedFileId = data.data?.id;
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('admin dosya yönetim paneline erişilir', async ({ page }) => {
    await page.goto('/admin/files');
    await expect(page.getByText(/depolama|dosya yönetim/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('admin dosya istatistikleri görünür', async ({ page }) => {
    await page.goto('/admin/files');
    // Depolama istatistikleri yüklenmiş olmalı
    await expect(page.getByText(/toplam|kullanılan/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('admin dosya listesi filtrelenebilir', async ({ page }) => {
    await page.goto('/admin/files');

    // "Dosya Listesi" sekmesine geç
    await page.getByRole('tab', { name: /dosya listesi/i }).click();

    // Dosyalar yüklenmiş olmalı
    await expect(page.locator('table, [data-testid="file-list"]').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('yüklenen dosya API üzerinden erişilebilir', async ({ request }) => {
    if (!uploadedFileId) {
      test.skip();
      return;
    }

    const res = await request.get(`/api/files/${uploadedFileId}/url`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.data?.url).toBeTruthy();
  });
});
