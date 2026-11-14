import { expect, test, type Page } from '@playwright/test';
import { showSource } from './helpers/editor-panels';

const source = `{
  // User-authored WaveDrom source
  signal: [
    { name: 'request', wave: '01......', node: '.a......' },
    { name: 'response', wave: '0....1..', node: '.....b..' },
  ],
  edge: ['a~>b latency'],
}`;

async function setup(page: Page) {
  await page.goto('/');
  await showSource(page);
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText(source);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const handle = page.locator('circle[data-edge-index="0"]');
  await expect(handle).toBeVisible();
  return { editor, handle };
}

async function beginDrag(page: Page) {
  const handle = page.locator('circle[data-edge-index="0"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error('Curve handle is not visible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 24, y, { steps: 8 });
  return { x, y };
}

test('reshapes a WaveDrom arrow without switching formats and undoes the whole drag', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { editor, handle } = await setup(page);
  const initialPath = await handle.locator('..').locator('path').first().getAttribute('d');
  const { x, y } = await beginDrag(page);
  await page.mouse.up();
  await expect(editor).toContainText('edgeCurveControls');
  await expect(editor).not.toContainText('0.15000000000000002');
  await expect(editor).toContainText('// User-authored WaveDrom source');
  await expect(page.getByText('WaveDrom JSON', { exact: true })).toBeVisible();
  await expect(page.getByText('Undulate JSON', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Undulate extensions')).not.toBeChecked();
  await expect(handle.locator('..').locator('path').first()).not.toHaveAttribute('d', initialPath!);
  const movedBox = await handle.boundingBox();
  expect(movedBox!.x + movedBox!.width / 2).toBeCloseTo(x + 24, 1);

  const reshaped = await editor.innerText();
  await page.keyboard.press('Control+z');
  await expect(editor).not.toContainText('edgeCurveControls');
  await expect(handle.locator('..').locator('path').first()).toHaveAttribute('d', initialPath!);
  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => editor.innerText()).toBe(reshaped);

  // Browser recovery must reopen the custom curve without changing syntax.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.reload();
  await showSource(page);
  await expect(editor).toContainText('edgeCurveControls');
  await expect(page.getByText('WaveDrom JSON', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.locator('circle[data-edge-index="0"]')).toBeVisible();
  expect(errors).toEqual([]);
  await page.mouse.move(x, y);
});

test('undo and document replacement during an active drag do not leave a stale edge handle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const { editor } = await setup(page);
  const { x, y } = await beginDrag(page);
  await expect(editor).toContainText('edgeCurveControls');
  await page.keyboard.press('Control+z');
  await expect(editor).not.toContainText('edgeCurveControls');
  await page.mouse.move(x + 60, y, { steps: 5 });
  await page.mouse.up();
  await expect(editor).not.toContainText('edgeCurveControls');

  // A pointer cancellation must also end the drag before replacing its edge.
  await beginDrag(page);
  await page.locator('canvas').dispatchEvent('pointercancel', { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await editor.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('{ signal: [{ name: "replacement", wave: "01.." }] }');
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.locator('circle[data-edge-index]')).toHaveCount(0);
  await page.mouse.move(x + 80, y, { steps: 5 });
  await expect(editor).not.toContainText('edgeCurveControls');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Editor failed to load', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Escape ends curve dragging without later pointer movement changing the source', async ({ page }) => {
  const { editor } = await setup(page);
  const { x, y } = await beginDrag(page);
  await expect(editor).toContainText('edgeCurveControls');
  await page.keyboard.press('Escape');
  const stopped = await editor.innerText();
  await page.mouse.move(x + 70, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => editor.innerText()).toBe(stopped);
  await expect(page.getByText('WaveDrom JSON', { exact: true })).toBeVisible();
});
