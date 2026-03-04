/**
 * E2E Test: Login â†’ Mesaj GÃ¶nder â†’ Al
 * Sprint 14 â€” UAT
 */
import { test, expect } from '@playwright/test';
import { login, logout, TEST_ADMIN } from './helpers';

test.describe('Kimlik DoÄŸrulama', () => {
  test('boÅŸ form gÃ¶nderince hata mesajÄ± gÃ¶sterir', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /giriÅŸ/i }).click();
    await expect(page.getByText(/kullanÄ±cÄ± adÄ±.*ÅŸifre/i)).toBeVisible();
  });

  test('hatalÄ± ÅŸifre girilince hata mesajÄ± gÃ¶sterir', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/kullanÄ±cÄ± adÄ±/i).fill(TEST_ADMIN.username);
    await page.getByPlaceholder(/ÅŸifre/i).fill('yanlis_sifre_12345');
    await page.getByRole('button', { name: /giriÅŸ/i }).click();
    await expect(page.getByText(/hatalÄ±|geÃ§ersiz|yanlÄ±ÅŸ/i)).toBeVisible({ timeout: 5_000 });
  });

  test('geÃ§erli kimlik bilgileriyle giriÅŸ yapÄ±lÄ±r', async ({ page }) => {
    await login(page);
    // Chat layout yÃ¼klenmiÅŸ olmalÄ±
    await expect(page.getByText('AlbaChat')).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });

  test('Ã§Ä±kÄ±ÅŸ yapÄ±nca login sayfasÄ±na yÃ¶nlendirilir', async ({ page }) => {
    await login(page);
    await logout(page);
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('MesajlaÅŸma', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('grup listesi yÃ¼klenir', async ({ page }) => {
    // Sol sidebar'da en az 1 grup gÃ¶rÃ¼nmeli
    await expect(page.locator('[data-testid="group-list"]').first()).toBeVisible({ timeout: 8_000 });
  });

  test('mesaj gÃ¶nderilip anlÄ±k olarak gÃ¶rÃ¼nÃ¼r', async ({ page }) => {
    // Ä°lk gruba tÄ±kla
    const firstGroup = page.locator('[data-testid="group-item"]').first();
    await firstGroup.click();

    const testMsg = `E2E Test MesajÄ± â€” ${Date.now()}`;

    // Mesaj yaz ve gÃ¶nder
    const input = page.getByPlaceholder(/mesaj yazÄ±n|bir ÅŸeyler yazÄ±n/i);
    await input.fill(testMsg);
    await input.press('Enter');

    // Mesaj listede gÃ¶rÃ¼nmeli
    await expect(page.getByText(testMsg)).toBeVisible({ timeout: 5_000 });
  });

  test('enter tuÅŸuyla mesaj gÃ¶nderilir', async ({ page }) => {
    const firstGroup = page.locator('[data-testid="group-item"]').first();
    await firstGroup.click();

    const testMsg = `Enter Test â€” ${Date.now()}`;
    const input = page.getByPlaceholder(/mesaj yazÄ±n|bir ÅŸeyler yazÄ±n/i);
    await input.fill(testMsg);
    await input.press('Enter');

    await expect(page.getByText(testMsg)).toBeVisible({ timeout: 5_000 });
    // Input temizlenmiÅŸ olmalÄ±
    await expect(input).toHaveValue('');
  });

  test('gÃ¶nder butonu ile mesaj gÃ¶nderilir', async ({ page }) => {
    const firstGroup = page.locator('[data-testid="group-item"]').first();
    await firstGroup.click();

    const testMsg = `Buton Test â€” ${Date.now()}`;
    const input = page.getByPlaceholder(/mesaj yazÄ±n|bir ÅŸeyler yazÄ±n/i);
    await input.fill(testMsg);
    await page.getByRole('button', { name: /gÃ¶nder/i }).click();

    await expect(page.getByText(testMsg)).toBeVisible({ timeout: 5_000 });
  });

  test('iki tarayÄ±cÄ± arasÄ±nda mesaj gerÃ§ek zamanlÄ± iletilir', async ({ page, context }) => {
    // Ä°kinci sayfa aÃ§ (aynÄ± session â€” farklÄ± kullanÄ±cÄ± gerekir; burada same-user multi-tab)
    const page2 = await context.newPage();
    await login(page2);

    const firstGroup = page.locator('[data-testid="group-item"]').first();
    await firstGroup.click();

    const firstGroup2 = page2.locator('[data-testid="group-item"]').first();
    await firstGroup2.click();

    const testMsg = `Realtime Test â€” ${Date.now()}`;
    await page.getByPlaceholder(/mesaj yazÄ±n|bir ÅŸeyler yazÄ±n/i).fill(testMsg);
    await page.getByPlaceholder(/mesaj yazÄ±n|bir ÅŸeyler yazÄ±n/i).press('Enter');

    // Her iki sayfada da gÃ¶rÃ¼nmeli
    await expect(page.getByText(testMsg)).toBeVisible({ timeout: 5_000 });
    await expect(page2.getByText(testMsg)).toBeVisible({ timeout: 5_000 });

    await page2.close();
  });
});

