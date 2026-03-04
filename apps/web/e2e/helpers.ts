/**
 * Playwright test yardÄ±mcÄ±larÄ± â€” ortak iÅŸlemler
 */
import { type Page, expect } from '@playwright/test';

export const TEST_ADMIN = {
  username: process.env.E2E_ADMIN_USER || 'admin',
  password: process.env.E2E_ADMIN_PASS || 'admin123',
  displayName: process.env.E2E_ADMIN_DISPLAY || 'Admin',
};

export const TEST_USER = {
  username: process.env.E2E_USER || 'testuser',
  password: process.env.E2E_USER_PASS || 'Test1234!',
  displayName: process.env.E2E_USER_DISPLAY || 'Test KullanÄ±cÄ±',
};

/** GiriÅŸ yap ve chat layout'un yÃ¼klenmesini bekle */
export async function login(page: Page, user = TEST_ADMIN) {
  await page.goto('/');
  await page.waitForURL(/\/(login|$)/);

  // Login sayfasÄ±na yÃ¶nlendirilmediyse zaten girilmiÅŸ
  if (!page.url().includes('login')) return;

  await page.getByPlaceholder(/kullanÄ±cÄ± adÄ±/i).fill(user.username);
  await page.getByPlaceholder(/ÅŸifre/i).fill(user.password);
  await page.getByRole('button', { name: /giriÅŸ/i }).click();

  // Chat arayÃ¼zÃ¼nÃ¼n yÃ¼klenmesini bekle
  await expect(page.getByText('AlbaChat')).toBeVisible({ timeout: 10_000 });
}

/** Ã‡Ä±kÄ±ÅŸ yap */
export async function logout(page: Page) {
  await page.getByTitle(/Ã§Ä±kÄ±ÅŸ/i).click();
  await page.waitForURL(/login/);
}

/** API isteÄŸi â€” backend token al */
export async function getApiToken(
  request: import('@playwright/test').APIRequestContext,
  user = TEST_ADMIN,
): Promise<string> {
  const res = await request.post('/api/auth/login', {
    data: { username: user.username, password: user.password },
  });
  const json = await res.json();
  return json.data.access_token as string;
}

