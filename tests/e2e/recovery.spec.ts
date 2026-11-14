import { expect, test } from '@playwright/test';
import { showSource } from './helpers/editor-panels';

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
});

test('shows browser recovery separately from disk saving and restores incomplete source', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [{
        name: 'recovery.json',
        getFile: async () => new File([
          JSON.stringify({ signal: [{ name: 'recovery_signal', wave: '01..' }] }, null, 2),
        ], 'recovery.json', { type: 'application/json' }),
      }],
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /File/ }).click();
  await page.getByRole('button', { name: 'Open document…', exact: true }).click();
  await expect(page.locator('[data-signal-row="true"]').filter({ hasText: 'recovery_signal' })).toBeVisible();
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('recovery.json');

  await showSource(page);
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.press(`${modifier}+End`);
  await editor.press('Backspace');
  await expect(page.getByLabel('Browser recovery status')).toHaveText('Recovery saved in browser');
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('wavedrom-gui-draft');
    return raw ? JSON.parse(raw).source?.code : null;
  })).toMatch(/"recovery_signal"/);
  const incompleteSource = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('wavedrom-gui-draft')!).source.code as string;
  });
  expect(() => JSON.parse(incompleteSource)).toThrow();

  await page.reload();
  await showSource(page);
  await expect(page.getByText('Restored browser draft', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('recovery.json');
  await expect(editor).toHaveText(incompleteSource);
  await expect(page.getByText('Saved to disk', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Browser recovery status')).toHaveText('Recovery saved in browser');
  await page.getByRole('button', { name: 'Dismiss recovery notice' }).click();
  await expect(page.getByText('Restored browser draft', { exact: false })).toHaveCount(0);
});

test('warns when recovery cannot survive a reload because storage is full', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await expect(page.getByLabel('Browser recovery status'))
    .toHaveText('Recovery unavailable — save a file');
  await page.getByLabel('More steps', { exact: true }).click();
  await expect(page.getByLabel('Browser recovery status'))
    .toHaveText('Recovery unavailable — save a file');
  await expect(page.getByText('Recovery saved in browser', { exact: true })).toHaveCount(0);
});

test('flushes a pending recovery snapshot when the page is hidden', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Browser recovery status')).toHaveText('Recovery saved in browser');
  const steps = page.getByLabel('Diagram step count');
  const before = Number(await steps.inputValue());
  await page.getByLabel('More steps', { exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('wavedrom-gui-draft')!).diagram.config.totalSteps;
  })).toBe(before + 1);
  await page.reload();
  await expect(steps).toHaveValue(String(before + 1));
});
