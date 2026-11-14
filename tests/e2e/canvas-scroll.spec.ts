import { expect, test, type Page } from '@playwright/test';
import { showSource } from './helpers/editor-panels';

const longSource = JSON.stringify({
  signal: Array.from({ length: 30 }, (_, i) => ({ name: `lane_${i + 1}`, wave: '01'.repeat(32) })),
  head: { text: 'Scrollable signals', tick: 0 },
  foot: { text: 'Last signal is reachable', tock: 1 },
});

async function replaceSource(page: Page, source: string) {
  await showSource(page);
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.press('Control+a');
  await page.keyboard.insertText(source);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
  await page.getByTitle('Show or hide source editor', { exact: true }).click();
}

const horizontal = (page: Page) => page.getByRole('region', { name: 'Scroll waveform steps horizontally' });
const vertical = (page: Page) => page.getByRole('region', { name: 'Scroll waveform signals vertically' });

async function scrollPosition(page: Page) {
  return {
    x: await horizontal(page).evaluate((el) => el.scrollLeft),
    y: await vertical(page).evaluate((el) => el.scrollTop),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await replaceSource(page, longSource);
});

test('native rails expose both axes and reach the last rows including the footer', async ({ page }) => {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const outer = await page.locator('.waveformViewport').boundingBox();
  expect(outer!.width - box!.width).toBeCloseTo(18, 0);
  expect(outer!.height - box!.height).toBeCloseTo(18, 0);
  await expect(horizontal(page)).toBeVisible();
  await expect(vertical(page)).toBeVisible();
  expect(await horizontal(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await vertical(page).evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  await horizontal(page).focus();
  await page.keyboard.press('End');
  await expect.poll(async () => (await scrollPosition(page)).x).toBeGreaterThan(0);
  await vertical(page).focus();
  await page.keyboard.press('End');
  await expect.poll(() => vertical(page).evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  const panel = page.locator('[aria-label="Signals panel"] [class*="_scroll_"]');
  await expect.poll(async () => Math.abs(await panel.evaluate((el) => el.scrollTop) - (await scrollPosition(page)).y)).toBeLessThan(2);
  expect(await canvas.evaluate((el) => el.width / window.devicePixelRatio)).toBeCloseTo(box!.width, 0);
});

test('wheel and keyboard navigation keep the focused step and signal visible', async ({ page }) => {
  const canvas = page.locator('canvas');
  await canvas.hover();
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 350);
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await scrollPosition(page)).x).toBeGreaterThan(100);
  expect((await scrollPosition(page)).y).toBe(0);
  await page.mouse.wheel(0, 250);
  await expect.poll(async () => (await scrollPosition(page)).y).toBeGreaterThan(100);

  await canvas.focus();
  await page.keyboard.press('End');
  await expect(canvas).toHaveAttribute('aria-label', /lane_1, step 64 of 64/);
  await expect.poll(() => horizontal(page).evaluate((el) => Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft))).toBeLessThan(2);
  for (let i = 0; i < 29; i++) await page.keyboard.press('ArrowDown');
  await expect(canvas).toHaveAttribute('aria-label', /lane_30, step 64 of 64/);
  await expect.poll(async () => (await scrollPosition(page)).y).toBeGreaterThan(500);
  await page.keyboard.press('Home');
  await expect.poll(async () => (await scrollPosition(page)).x).toBe(0);
});

test('offsets clamp after zoom, resize and document replacement', async ({ page }) => {
  await horizontal(page).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await vertical(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(async () => (await scrollPosition(page)).y).toBeGreaterThan(0);
  const originalX = (await scrollPosition(page)).x;
  await page.getByTitle('Zoom out', { exact: true }).click();
  await expect.poll(async () => (await scrollPosition(page)).x).toBeLessThan(originalX);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => horizontal(page).evaluate((el) => Math.abs(el.scrollWidth - el.clientWidth - el.scrollLeft))).toBeLessThan(2);
  await replaceSource(page, '{signal: [{name: "short", wave: "01"}]}');
  await expect.poll(() => scrollPosition(page)).toEqual({ x: 0, y: 0 });
  expect(await horizontal(page).evaluate((el) => el.scrollWidth === el.clientWidth)).toBe(true);
  expect(await vertical(page).evaluate((el) => el.scrollHeight === el.clientHeight)).toBe(true);
  await expect(page.locator('canvas')).toHaveAttribute('aria-colcount', '2');
});

test('first pointer focus preserves scroll and fixed title clicks do not edit hidden rows', async ({ page }) => {
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await horizontal(page).evaluate((el) => { el.scrollLeft = 320; });
  await vertical(page).evaluate((el) => { el.scrollTop = 240; });
  await expect.poll(() => scrollPosition(page)).toEqual({ x: 320, y: 240 });
  const canvas = page.locator('canvas');
  // The first pointer focus after scrolling must not jump to keyboard cell 1.
  await canvas.click({ position: { x: 20, y: 84 } });
  await expect.poll(() => scrollPosition(page)).toEqual({ x: 320, y: 240 });
  await showSource(page);
  const sourceAfterPaint = await page.locator('.cm-content').innerText();
  await page.getByTitle('Show or hide source editor', { exact: true }).click();
  // y=30 lies in the fixed title between the 24px axis and signal rows.
  await canvas.click({ position: { x: 80, y: 30 } });
  await showSource(page);
  await expect(page.locator('.cm-content')).toHaveText(sourceAfterPaint, { useInnerText: true });
});


test('the last signal label stays above Add signal without a diagram footer', async ({ page }) => {
  const source = JSON.parse(longSource);
  delete source.foot;
  await replaceSource(page, JSON.stringify(source));
  await vertical(page).focus();
  await page.keyboard.press('End');
  await expect.poll(() => vertical(page).evaluate((el) => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop))).toBeLessThan(2);
  const label = page.getByText('lane_30', { exact: true });
  const panel = page.locator('[aria-label="Signals panel"] [class*="_scroll_"]');
  const panelBox = await panel.boundingBox();
  const labelBox = await label.boundingBox();
  expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
  // Keyboard navigation also uses the smaller shared viewport for label reveal.
  await page.locator('canvas').focus();
  for (let i = 0; i < 29; i++) await page.keyboard.press('ArrowDown');
  const focusedLabelBox = await label.boundingBox();
  expect(focusedLabelBox!.y + focusedLabelBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
});
