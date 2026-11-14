import { expect, test, type Page } from '@playwright/test';

const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
type SaveWindow = Window & { __busSave: { text: string; writes: number } };

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const testWindow = window as SaveWindow;
    testWindow.__busSave = { text: '', writes: 0 };
    const handle = {
      name: 'bus-edits.json',
      getFile: async () => new File([testWindow.__busSave.text], 'bus-edits.json', { type: 'application/json' }),
      createWritable: async () => ({
        write: async (blob: Blob) => {
          testWindow.__busSave.text = await blob.text();
          testWindow.__busSave.writes += 1;
        },
        close: async () => undefined,
        abort: async () => undefined,
      }),
    };
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => handle });
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: async () => [handle] });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Samples', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Sample library' });
  await library.locator('[data-sample-id="amba/apb/back-to-back"]').click();
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library).not.toBeVisible();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
});

async function selectData(page: Page, step: number) {
  const canvas = page.locator('canvas');
  const row = page.locator('[data-signal-row="true"]').filter({ hasText: 'PWDATA' });
  const rowBox = await row.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!rowBox || !canvasBox) throw new Error('PWDATA row or waveform is missing');
  // This sample's authored hscale=2 and initial zoom=1 give 80px cycles.
  await canvas.click({ position: { x: (step + 0.5) * 80, y: rowBox.y + rowBox.height / 2 - canvasBox.y } });
  await expect(page.getByLabel('Bus label', { exact: true })).toBeEnabled();
}

async function savedData(page: Page): Promise<string[]> {
  const text = await page.evaluate(() => (window as SaveWindow).__busSave.text);
  const json = JSON.parse(text) as { signal: Array<{ name: string; data?: string[] }> };
  return json.signal.find(({ name }) => name === 'PWDATA')!.data!;
}

test('commits an existing bus label, preserves adjacent data, and supports one-step undo/redo and save/reopen', async ({ page }) => {
  const label = page.getByLabel('Bus label', { exact: true });
  await expect(label).toBeDisabled();
  await page.locator('[data-signal-row="true"]').filter({ hasText: 'PWDATA' }).click();
  await expect(label).toBeDisabled();
  await selectData(page, 2);
  await expect(label).toHaveValue('0x00000011');
  await label.fill('0x11111111');
  await label.press('Enter');
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Unsaved changes');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await selectData(page, 2);
  await expect(label).toHaveValue('0x00000011');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await selectData(page, 2);
  await expect(label).toHaveValue('0x11111111');
  await selectData(page, 4);
  await expect(label).toHaveValue('0x00000022');
  await label.fill('discard me');
  await label.press('Escape');
  await expect(label).toHaveValue('0x00000022');
  await page.keyboard.press(`${mod}+s`);
  await expect.poll(() => page.evaluate(() => (window as SaveWindow).__busSave.writes)).toBe(1);
  expect(await savedData(page)).toEqual(['0x11111111', '0x00000022']);

  await page.getByRole('button', { name: 'File ▾', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: 'File ▾', exact: true }).click();
  await page.getByRole('button', { name: 'Open document…', exact: true }).click();
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('bus-edits.json');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await selectData(page, 2);
  await expect(label).toHaveValue('0x11111111');
  await selectData(page, 4);
  await expect(label).toHaveValue('0x00000022');
});

test('Ctrl/Cmd+S saves the typed label while the field is still focused', async ({ page }) => {
  await selectData(page, 2);
  const label = page.getByLabel('Bus label', { exact: true });
  await label.fill('0x33333333');
  await expect(label).toBeFocused();
  await label.press(`${mod}+s`);
  await expect.poll(() => page.evaluate(() => (window as SaveWindow).__busSave.writes)).toBe(1);
  expect(await savedData(page)).toEqual(['0x33333333', '0x00000022']);
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Saved to disk');

  await selectData(page, 4);
  await label.fill('0x44444444');
  await selectData(page, 2);
  await expect(label).toHaveValue('0x33333333');
  await page.keyboard.press(`${mod}+s`);
  await expect.poll(() => page.evaluate(() => (window as SaveWindow).__busSave.writes)).toBe(2);
  expect(await savedData(page)).toEqual(['0x33333333', '0x44444444']);
});
