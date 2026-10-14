import { test, expect } from '@playwright/test';

test('shows the saved confirmation', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForTimeout(2000);
  expect(await page.getByRole('status').textContent()).toContain('Profile saved');
});
