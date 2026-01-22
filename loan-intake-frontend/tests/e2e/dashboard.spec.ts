import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('auth_token', 'dummy.token.value');
      localStorage.setItem('user', JSON.stringify({ name: 'testuser2', email: 'test@example.com' }));
    } catch {}
  });
});

test('app loads and shows dashboard header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Farm Equipment Loan Intake')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
});