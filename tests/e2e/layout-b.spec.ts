import { expect, test } from '@playwright/test';
import { showPreview, showSource } from './helpers/editor-panels';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.appRoot')).toBeVisible();
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 700, height: 800 }]) {
  test(`canvas-first layout and independent toggles at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const controls = page.getByRole('group', { name: 'Workspace panels' });
    const canvasOnly = controls.getByRole('button', { name: 'Canvas only', exact: true });
    const source = controls.getByRole('button', { name: 'Source', exact: true });
    const preview = controls.getByRole('button', { name: 'Preview', exact: true });
    await expect(canvasOnly).toHaveAttribute('aria-pressed', 'true');
    await expect(source).toHaveAttribute('aria-pressed', 'false');
    await expect(preview).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.cm-content')).toHaveCount(0);
    const canvas = page.getByRole('grid', { name: /waveform/i });
    await expect(canvas).toBeVisible();
    const full = (await canvas.boundingBox())!;
    expect(full.height).toBeGreaterThan(viewport.height * 0.55);
    expect(full.width).toBeGreaterThan(viewport.width * 0.6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await showSource(page);
    await expect(preview).toHaveAttribute('aria-pressed', 'false');
    await showPreview(page);
    await expect(source).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Close Source panel', exact: true }).click();
    await expect(source).toHaveAttribute('aria-pressed', 'false');
    await expect(preview).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Close Preview panel', exact: true }).click();
    await expect(canvasOnly).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await canvas.boundingBox())!.height).toBeGreaterThanOrEqual(full.height - 1);
    await showSource(page);
    await showPreview(page);
    await canvasOnly.click();
    await expect(source).toHaveAttribute('aria-pressed', 'false');
    await expect(preview).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.cm-content')).toHaveCount(0);
  });
}

test('closing and reopening Source preserves an invalid draft and its undo history', async ({ page }) => {
  await showSource(page);
  const editor = page.locator('.cm-content');
  const original = await editor.innerText();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('{ signal: [');
  await expect(editor).toHaveText('{ signal: [');
  await page.getByRole('button', { name: 'Close Source panel', exact: true }).click();
  await showSource(page);
  await expect(editor).toHaveText('{ signal: [');
  await editor.click();
  await page.keyboard.press('Control+z');
  await expect(editor).toHaveText(original, { useInnerText: true });
});

test('floating Source keeps its placement after closing and reopening', async ({ page }) => {
  await showSource(page);
  await page.getByTitle('Floating window', { exact: true }).click();
  const floating = page.getByRole('dialog', { name: 'Source panel', exact: true });
  await expect(floating).toBeVisible();
  await floating.getByRole('button', { name: 'Close Source panel' }).click();
  await expect(floating).toHaveCount(0);
  await showSource(page);
  await expect(floating).toBeVisible();
  await expect(floating.getByTitle('Floating window', { exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('sample library remains reachable with panels closed and opens an editable copy', async ({ page }) => {
  await page.getByRole('button', { name: 'Samples', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Sample library' });
  await expect(library.getByRole('img')).toBeVisible();
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await showSource(page);
  await expect(page.locator('.cm-content')).toContainText('PCLK');
  await showPreview(page);
  await expect(page.getByText('WaveDrom render (local)', { exact: true }).locator('..').locator('svg')).toBeVisible();
});
