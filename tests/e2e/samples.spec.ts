import { expect, test, type Page } from '@playwright/test';
import { showSource } from './helpers/editor-panels';

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Samples', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Sample library' });
  await expect(library).toBeVisible();
  await expect(library.getByRole('img')).toBeVisible();
  return library;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.appRoot')).toBeVisible();
  await showSource(page);
});

test('browses a small AMBA collection, previews without editing, and opens a copy', async ({ page }) => {
  const source = await page.locator('.cm-content').innerText();
  const library = await openLibrary(page);
  await expect(library.getByRole('option')).toHaveCount(10);
  await expect(library.getByRole('heading', { name: 'Step by step' })).toBeVisible();
  await library.getByRole('button', { name: 'AXI', exact: true }).click();
  await expect(library.getByRole('option')).toHaveCount(2);
  await library.locator('[data-sample-id="amba/axi/read"]').click();
  await expect(library.getByRole('img', { name: /AXI .*read.*waveform/ })).toBeVisible();
  expect(await page.locator('.cm-content').innerText()).toBe(source);
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library).not.toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('ARVALID');
  await expect(page.getByRole('button', { name: 'Samples', exact: true })).toBeFocused();
});

test('keyboard navigation keeps selection and preview aligned and traps focus', async ({ page }) => {
  const library = await openLibrary(page);
  const search = library.getByRole('searchbox', { name: 'Search samples' });
  await expect(search).toBeFocused();
  await search.press('ArrowDown');
  await expect(library.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const second = library.getByRole('option').nth(1);
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute('aria-selected', 'true');
  await expect(library.getByRole('img', { name: /APB read.*waveform/ })).toBeVisible();
  await page.keyboard.press('End');
  await expect(library.getByRole('option').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(library.getByRole('option').first()).toBeFocused();
  await page.keyboard.press('Control+f');
  await expect(search).toBeFocused();
  await search.fill('unfindable');
  await expect(library.getByText('No matching samples', { exact: true })).toBeVisible();
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(library).toBeVisible();
  await library.getByRole('button', { name: 'Open copy', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(library.getByRole('button', { name: 'Close sample library' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(library.getByRole('button', { name: 'Open copy', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(library).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Samples', exact: true })).toBeFocused();
});

test('renders each bundled sample as a real waveform', async ({ page }) => {
  const library = await openLibrary(page);
  await library.getByRole('button', { name: /^All samples/ }).click();
  const options = library.getByRole('option');
  await expect(options).toHaveCount(19);
  for (let index = 0; index < 19; index++) {
    await options.nth(index).click();
    await expect(library.getByRole('img')).toBeVisible();
    await expect.poll(() => library.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
});

test('walks through wait states with aligned highlights, readable labels, and an unchanged full copy', async ({ page }) => {
  const before = await page.locator('.cm-content').innerText();
  const library = await openLibrary(page);
  await library.locator('[data-sample-id="amba/apb/read-wait"]').click();
  const image = library.getByRole('img');
  const highlight = library.locator('[data-highlight-start]');
  await expect(highlight).toHaveAttribute('data-highlight-start', '2');
  await library.getByRole('button', { name: 'Next stage', exact: true }).click();
  await expect(highlight).toHaveAttribute('data-highlight-start', '3');
  await expect(highlight).toHaveAttribute('data-highlight-end', '5');
  await expect(library.getByLabel('Current stage')).toContainText('PREADY=0');
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalHeight === img.height && img.complete)).toBe(true);

  // Highlight SVG and source image must share the same coordinate space after loading.
  const alignment = await highlight.evaluate((svg) => {
    const img = svg.parentElement!.querySelector('img')!;
    const a = img.getBoundingClientRect();
    const b = svg.getBoundingClientRect();
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.width - b.width) + Math.abs(a.height - b.height);
  });
  expect(alignment).toBeLessThan(1);
  const focusedHeight = await image.getAttribute('height');
  await library.getByRole('button', { name: 'All signals', exact: true }).click();
  await expect.poll(() => image.getAttribute('height')).not.toBe(focusedHeight);
  const fullHeight = Number(await image.getAttribute('height'));
  expect(fullHeight).toBeGreaterThan(Number(focusedHeight));
  await library.getByRole('button', { name: 'Stage signals', exact: true }).click();
  await library.getByRole('button', { name: 'Next stage', exact: true }).click();
  await expect(highlight).toHaveAttribute('data-highlight-start', '5');
  await expect(library.getByLabel('Current stage')).toContainText('0xA5A5');
  await page.setViewportSize({ width: 375, height: 812 });
  const viewport = library.getByLabel('Scrollable waveform');
  await viewport.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const bounds = await viewport.boundingBox();
    const band = await highlight.locator('rect').boundingBox();
    return Boolean(bounds && band && band.x >= bounds.x + 140
      && band.x + band.width <= bounds.x + bounds.width + 1);
  }).toBe(true);
  await expect.poll(() => page.locator('.cm-content').innerText()).toBe(before);

  await library.getByText('Reveal explanation', { exact: true }).click();
  await expect(library.getByRole('region', { name: 'Lesson notes' })).toContainText('valid data is required');
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library).not.toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('PWRITE');
  await expect(page.locator('.cm-content')).toContainText('PSLVERR');
  await expect(page.locator('.cm-content')).toContainText('"hscale": 4');
});

test('continues the protocol learning path and resets walkthrough stages', async ({ page }) => {
  const library = await openLibrary(page);
  await library.getByRole('button', { name: 'Next stage', exact: true }).click();
  await library.getByRole('button', { name: /Next lesson.*APB read without wait states/ }).click();
  await expect(library.getByRole('heading', { name: 'APB read without wait states', exact: true })).toBeVisible();
  await expect(library.getByRole('button', { name: 'Previous stage', exact: true })).toBeDisabled();
  await expect(library.locator('[data-highlight-start]')).toHaveAttribute('data-highlight-start', '2');
});

test('preserves an invalid source draft when opening is declined', async ({ page }) => {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('{ signal: [');
  const library = await openLibrary(page);
  page.once('dialog', async (dialog) => dialog.dismiss());
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library).toBeVisible();
  await expect(editor).toHaveText('{ signal: [');
  await library.getByRole('button', { name: 'Close sample library' }).click();
  await expect(editor).toHaveText('{ signal: [');
});

test('cancels a pending open when the library closes', async ({ page }) => {
  const library = await openLibrary(page);
  const before = await page.locator('.cm-content').innerText();
  let finishRequest: (() => void) | undefined;
  await page.route('**/samples/amba-apb-write.json', async (route) => {
    await new Promise<void>((resolve) => { finishRequest = resolve; });
    await route.continue().catch(() => undefined);
  });
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Opening…' })).toBeDisabled();
  await expect.poll(() => Boolean(finishRequest)).toBe(true);
  await library.getByRole('button', { name: 'Close sample library' }).click();
  finishRequest!();
  await expect(library).not.toBeVisible();
  await expect.poll(() => page.locator('.cm-content').innerText()).toBe(before);
});

test('shows a retryable preview error without inventing a waveform', async ({ page }) => {
  await page.route('**/samples/amba-apb-write.json', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Samples', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Sample library' });
  await expect(library.getByRole('alert')).toHaveText('Preview unavailable');
  await expect(library.getByRole('img')).toHaveCount(0);
  await page.unroute('**/samples/amba-apb-write.json');
  await library.getByRole('button', { name: 'Retry preview' }).click();
  await expect(library.getByRole('img')).toBeVisible();
});

test('fits narrow screens and keeps learning notes and opening reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const library = await openLibrary(page);
  await library.getByRole('button', { name: 'AHB', exact: true }).click();
  await expect(library.getByRole('option')).toHaveCount(2);
  await library.getByRole('option').last().click();
  await expect(library.getByRole('img')).toBeVisible();
  expect(await library.evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await library.getByRole('button', { name: 'Open copy', exact: true }).scrollIntoViewIfNeeded();
  await expect(library.getByRole('button', { name: 'Open copy', exact: true })).toBeInViewport();
  await library.getByRole('button', { name: 'Open copy', exact: true }).click();
  await expect(library).not.toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('HTRANS');
});
