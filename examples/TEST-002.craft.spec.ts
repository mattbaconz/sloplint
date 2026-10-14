import { test, expect } from '@playwright/test';

test('shows the saved confirmation', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved');
});
