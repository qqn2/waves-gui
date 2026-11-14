import { expect, test, type Page } from '@playwright/test';

const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

type FileTestWindow = Window & {
  __fileTest: {
    mode: 'save' | 'cancel' | 'fail';
    originalWrites: number;
    copyWrites: number;
    pickerCalls: number;
    savedText: string;
  };
};

async function openOriginal(page: Page) {
  await page.getByRole('button', { name: 'File ▾', exact: true }).click();
  await page.getByRole('button', { name: 'Open document…', exact: true }).click();
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('original.json');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const testWindow = window as FileTestWindow;
    testWindow.__fileTest = {
      mode: 'save', originalWrites: 0, copyWrites: 0, pickerCalls: 0, savedText: '',
    };
    const source = JSON.stringify({ signal: [{ name: 'file_clock', wave: '01..' }] });
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [{
        name: 'original.json',
        getFile: async () => new File([source], 'original.json', { type: 'application/json' }),
        createWritable: async () => ({
          write: async (blob: Blob) => {
            testWindow.__fileTest.originalWrites += 1;
            testWindow.__fileTest.savedText = await blob.text();
          },
          close: async () => undefined,
        }),
      }],
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        testWindow.__fileTest.pickerCalls += 1;
        if (testWindow.__fileTest.mode === 'cancel') throw new DOMException('Cancelled', 'AbortError');
        return {
          name: 'copy.json',
          createWritable: async () => ({
            write: async (blob: Blob) => {
              if (testWindow.__fileTest.mode === 'fail') throw new Error('Disk full');
              testWindow.__fileTest.copyWrites += 1;
              testWindow.__fileTest.savedText = await blob.text();
            },
            close: async () => undefined,
            abort: async () => undefined,
          }),
        };
      },
    });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
});

test('shows filename and distinguishes new documents, unsaved edits and confirmed disk saves', async ({ page }) => {
  const status = page.getByLabel('Document save status', { exact: true });
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('Untitled');
  await expect(status).toHaveText('Not saved to disk');
  await openOriginal(page);
  await expect(status).toHaveText('Saved to disk');
  await page.getByLabel('More steps', { exact: true }).click();
  await expect(status).toHaveText('Unsaved changes');
  await page.keyboard.press(`${mod}+s`);
  await expect(status).toHaveText('Saved to disk');
  expect(await page.evaluate(() => (window as FileTestWindow).__fileTest.originalWrites)).toBe(1);
  expect(await page.evaluate(() => (window as FileTestWindow).__fileTest.pickerCalls)).toBe(0);
});

test('Save As chooses a new file and subsequent Save writes to that file', async ({ page }) => {
  await openOriginal(page);
  await page.getByLabel('More steps', { exact: true }).click();
  await page.getByRole('button', { name: 'File ▾', exact: true }).click();
  await page.getByRole('button', { name: 'Save As…', exact: true }).click();
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('copy.json');
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Saved to disk');
  await page.getByLabel('More steps', { exact: true }).click();
  await page.keyboard.press(`${mod}+s`);
  await expect.poll(() => page.evaluate(() => (window as FileTestWindow).__fileTest.copyWrites)).toBe(2);
  const result = await page.evaluate(() => (window as FileTestWindow).__fileTest);
  expect(result.originalWrites).toBe(0);
  expect(result.pickerCalls).toBe(1);
  expect(result.savedText).toContain('file_clock');
});

test('cancelling Save As from the keyboard preserves the original filename, savepoint and target', async ({ page }) => {
  await openOriginal(page);
  await page.getByLabel('More steps', { exact: true }).click();
  await page.evaluate(() => { (window as FileTestWindow).__fileTest.mode = 'cancel'; });
  await page.keyboard.press(`${mod}+Shift+s`);
  await expect.poll(() => page.evaluate(() => (window as FileTestWindow).__fileTest.pickerCalls)).toBe(1);
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('original.json');
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Unsaved changes');
  await page.keyboard.press(`${mod}+s`);
  await expect.poll(() => page.evaluate(() => (window as FileTestWindow).__fileTest.originalWrites)).toBe(1);
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Saved to disk');
});

test('failed Save As leaves work unsaved and the original file usable', async ({ page }) => {
  await openOriginal(page);
  await page.getByLabel('More steps', { exact: true }).click();
  await page.evaluate(() => { (window as FileTestWindow).__fileTest.mode = 'fail'; });
  await page.keyboard.press(`${mod}+Shift+s`);
  await expect(page.getByLabel('Document save status', { exact: true })).toContainText('Save failed: Disk full');
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('original.json');
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
  await page.keyboard.press(`${mod}+s`);
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Saved to disk');
  expect(await page.evaluate(() => (window as FileTestWindow).__fileTest.originalWrites)).toBe(1);
});

test('download-only Save As keeps dirty work and reports an unconfirmed download', async ({ page }) => {
  await openOriginal(page);
  await page.getByLabel('More steps', { exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });
  const downloading = page.waitForEvent('download');
  await page.keyboard.press(`${mod}+Shift+s`);
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('original.json');
  await expect(page.getByLabel('Document save status', { exact: true })).toHaveText('Download requested — check your downloads');
  await expect(page.getByLabel('Current filename', { exact: true })).toHaveText('original.json');
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wavedrom-gui-draft'))).not.toBeNull();
  expect(await page.evaluate(() => (window as FileTestWindow).__fileTest.originalWrites)).toBe(0);
});
