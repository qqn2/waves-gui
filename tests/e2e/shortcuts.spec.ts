import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.appRoot')).toBeVisible();
});

test('advertised Edge, Span, and Invert shortcuts activate distinct tools', async ({ page }) => {
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: 'Edge', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Edge', exact: true }))
    .toHaveAttribute('title', 'Edge (A)');

  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: 'Span', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Span', exact: true }))
    .toHaveAttribute('title', 'Span (T)');

  await page.keyboard.press('Shift+T');
  await expect(page.getByRole('button', { name: 'Draw', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Invert', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Invert', exact: true }))
    .toHaveAttribute('title', /Shift\+T/);

  await page.getByRole('button', { name: 'Help and keyboard shortcuts' }).click();
  const help = page.getByRole('dialog', { name: 'Help & About' });
  await expect(help.getByRole('row').filter({ hasText: 'Span tool' })).toContainText('T');
  await expect(help.getByRole('row').filter({ hasText: 'Invert waveform values' }))
    .toContainText('Shift+T');
});

test('Undulate shortcuts remain separate from core tools', async ({ page }) => {
  await page.getByLabel('Undulate extensions').check();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.keyboard.press('Shift+A');
  await expect(page.getByRole('button', { name: 'Arrow', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('a');
  await expect(page.getByRole('button', { name: 'Edge', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Shift+D');
  await expect(page.getByRole('button', { name: 'Analog paint', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('d');
  await expect(page.getByRole('button', { name: 'Draw', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
});

test('typing and modified keys do not activate editing tools', async ({ page }) => {
  const select = page.getByRole('button', { name: 'Select', exact: true });
  await select.click();
  const filter = page.getByRole('textbox', { name: 'Filter signals and sections by name' });
  await filter.pressSequentially('atde');
  await expect(filter).toHaveValue('atde');
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await filter.fill('');

  await page.getByRole('button', { name: 'Diagram settings', exact: true }).click();
  await page.getByLabel('WaveDrom skin').press('d');
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await select.click();
  await page.keyboard.press('Alt+a');
  await expect(select).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+a');
  await expect(select).toHaveAttribute('aria-pressed', 'true');
});
