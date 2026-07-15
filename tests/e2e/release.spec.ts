import { expect, test, type Page } from '@playwright/test';

const editedDiagram = JSON.stringify({
  signal: [
    { name: 'clk', wave: 'P....' },
    { name: 'safe_bus', wave: '=.=..', data: ['A0', 'A1'] },
  ],
  head: { text: 'E2E recovery draft' },
  config: { hscale: 1 },
}, null, 2);

async function replaceJson(page: Page, json: string): Promise<void> {
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(json);
  await page.waitForTimeout(500);
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await expect(page.locator('.appRoot')).toBeVisible();
});

test('starts cleanly and never offers diagram transmission', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.reload();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Web', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="wavedrom.com/editor"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('synchronizes JSON, supports undo/redo, and restores the local draft', async ({ page }) => {
  await replaceJson(page, editedDiagram);
  await expect(page.getByTitle('safe_bus')).toBeVisible();
  await page.waitForTimeout(1_200);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wavedrom-gui-draft'))).not.toBeNull();

  const steps = page.getByLabel('Diagram step count');
  const before = await steps.inputValue();
  await page.getByLabel('More steps').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(steps).toHaveValue(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(steps).toHaveValue(String(Number(before) + 1));

  await page.reload();
  await expect(page.getByTitle('safe_bus')).toBeVisible();
});

test('raw JSON edits are dirty and participate in unified undo/redo', async ({ page }) => {
  await replaceJson(page, editedDiagram);
  await expect(page.getByTitle('safe_bus')).toBeVisible();
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(page.getByTitle('safe_bus')).toHaveCount(0);
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTitle('safe_bus')).toBeVisible();
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
});

test('dirty state follows the confirmed savepoint across undo', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => ({
        name: 'saved.json',
        createWritable: async () => ({
          write: async () => undefined,
          close: async () => undefined,
        }),
      }),
    });
  });
  await replaceJson(page, editedDiagram);
  await page.getByRole('button', { name: /File/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);

  await page.getByLabel('More steps').click();
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTitle('safe_bus')).toHaveCount(0);
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
});

test('Open retains its file handle and Ctrl+S writes back without Save As', async ({ page }) => {
  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __writes?: number;
      __saveAsCalls?: number;
    };
    testWindow.__writes = 0;
    testWindow.__saveAsCalls = 0;
    const source = JSON.stringify({ signal: [{ name: 'opened_handle', wave: '01..' }] });
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [{
        name: 'opened.json',
        getFile: async () => new File([source], 'opened.json', { type: 'application/json' }),
        createWritable: async () => ({
          write: async () => { testWindow.__writes = (testWindow.__writes ?? 0) + 1; },
          close: async () => undefined,
        }),
      }],
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        testWindow.__saveAsCalls = (testWindow.__saveAsCalls ?? 0) + 1;
        throw new DOMException('cancelled', 'AbortError');
      },
    });
  });

  await page.getByRole('button', { name: /File/ }).click();
  await page.getByRole('button', { name: /Open/ }).click();
  await expect(page.getByTitle('opened_handle')).toBeVisible();
  await page.getByLabel('More steps').click();
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');

  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __writes?: number }
  ).__writes)).toBe(1);
  expect(await page.evaluate(() => (
    window as typeof window & { __saveAsCalls?: number }
  ).__saveAsCalls)).toBe(0);
});

test('invalid JSON never mutates the diagram or history', async ({ page }) => {
  const steps = page.getByLabel('Diagram step count');
  const before = await steps.inputValue();
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText('{"signal": [');
  await page.waitForTimeout(500);

  await expect(page.getByText('Invalid JSON syntax', { exact: true })).toBeVisible();
  await expect(page.getByTitle('clk')).toBeVisible();
  await expect(steps).toHaveValue(before);
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTitle('clk')).toBeVisible();
  await expect(steps).toHaveValue(before);
});

test('fallback Save download preserves recovery data and dirty state', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: undefined,
    });
  });
  await replaceJson(page, editedDiagram);
  await page.waitForTimeout(1_200);
  const draftBefore = await page.evaluate(() => localStorage.getItem('wavedrom-gui-draft'));
  expect(draftBefore).not.toBeNull();

  await page.getByRole('button', { name: /File/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await downloadPromise;

  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wavedrom-gui-draft'))).toBe(draftBefore);
});

test('waveform cells expose keyboard focus and position status', async ({ page }) => {
  const canvas = page.getByRole('grid', { name: /Waveform editor/ });
  await canvas.focus();
  await expect(canvas).toHaveAttribute('aria-label', /clk, step 1 of/i);
  await page.keyboard.press('ArrowRight');
  await expect(canvas).toHaveAttribute('aria-label', /clk, step 2 of/i);
  await page.keyboard.press('ArrowDown');
  await expect(canvas).toHaveAttribute('aria-label', /reset_n, step 2 of/i);
  await expect(page.locator('.pointerMarkerLabel')).toContainText('reset_n');
});

for (const format of ['json', 'svg', 'png'] as const) {
  test(`downloads ${format.toUpperCase()} export`, async ({ page }) => {
    await page.getByRole('button', { name: /File/ }).click();
    await page.getByRole('button', { name: /Export/ }).click();
    await page.locator('#export-format').selectOption(format);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    await expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`, 'i'));
  });
}

test('Help/About exposes privacy and project routes', async ({ page }) => {
  await page.getByTitle('Help and keyboard shortcuts').click();
  await expect(page.getByRole('heading', { name: 'Help & About' })).toBeVisible();
  await expect(page.getByText(/full recovery draft and recent filenames/i)).toBeVisible();
  await expect(page.getByText(/independent community project/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://github.com/qqn2/waves-gui');
  await expect(page.getByRole('link', { name: 'Report a bug' })).toHaveAttribute('href', /github\.com\/qqn2\/waves-gui\/issues/);
  await expect(page.getByRole('link', { name: 'Licenses' })).toHaveAttribute('href', '/licenses/THIRD_PARTY_NOTICES.txt');
});

test('hostile labels stay text in the local preview', async ({ page }) => {
  const hostile = JSON.stringify({
    signal: [
      { name: '<script>window.pwned=1</script>', wave: '0.1.' },
      { name: '<img onerror=window.pwned=2>', wave: '=...', data: ['javascript:alert(1)'] },
    ],
  }, null, 2);
  await replaceJson(page, hostile);
  await expect(page.getByText('<script>window.pwned=1</script>', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.preview script, .preview foreignObject, .preview image')).toHaveCount(0);
  expect(await page.evaluate(() => (window as typeof window & { pwned?: number }).pwned)).toBeUndefined();
});

for (const viewport of [
  { name: 'narrow', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`renders the ${viewport.name} layout`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.locator('.appRoot')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  });
}

test('serves security headers, licenses, and SPA fallback', async ({ request }) => {
  const root = await request.get('/');
  expect(root.ok()).toBeTruthy();
  expect(root.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(root.headers()['x-content-type-options']).toBe('nosniff');
  const licenses = await request.get('/licenses/THIRD_PARTY_NOTICES.txt');
  expect(licenses.ok()).toBeTruthy();
  expect(await licenses.text()).toContain('wavedrom 3.6.1');
  const fallback = await request.get('/diagram/synthetic-route', {
    headers: { 'Sec-Fetch-Mode': 'navigate' },
  });
  expect(fallback.ok()).toBeTruthy();
  expect(await fallback.text()).toContain('<div id="root"></div>');
});
