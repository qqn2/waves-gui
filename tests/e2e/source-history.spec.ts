import { expect, test, type Page } from '@playwright/test';
import { showSource } from './helpers/editor-panels';

const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

async function removeClosingBrace(page: Page) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.press(`${modifier}+End`);
  await editor.press('Backspace');
  await expect(page.getByText('✓ Valid', { exact: true })).toHaveCount(0);
  return editor;
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await showSource(page);
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
});

test('undo and redo repair invalid source using editor shortcuts and toolbar', async ({ page }) => {
  const editor = page.locator('.cm-content');
  const original = await editor.innerText();
  await removeClosingBrace(page);
  const invalid = await editor.innerText();
  await editor.press(`${modifier}+z`);
  await expect(editor).toHaveText(original, { useInnerText: true });
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(editor).toHaveText(invalid, { useInnerText: true });
  await expect(page.getByText('✓ Valid', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(editor).toHaveText(original, { useInnerText: true });
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();

  await editor.press(`${modifier}+Shift+Z`);
  await expect(editor).toHaveText(invalid, { useInnerText: true });
  await editor.press(`${modifier}+z`);
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
});

test('invalid source undo preserves earlier diagram history and drops stale redo after a canvas control edit', async ({ page }) => {
  const editor = page.locator('.cm-content');
  await page.getByLabel('More steps', { exact: true }).click();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('11');
  await removeClosingBrace(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('11');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('10');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('11');
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();

  await removeClosingBrace(page);
  await editor.press(`${modifier}+z`);
  await page.getByLabel('More steps', { exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('12');
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
});

test('invalid recovered source can be undone without losing its diagram', async ({ page }) => {
  await page.getByLabel('More steps', { exact: true }).click();
  await removeClosingBrace(page);
  await expect(page.getByText('Recovery saved in browser', { exact: true })).toBeVisible();
  await page.reload();
  await showSource(page);
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('11');
  await expect(page.getByText('✓ Valid', { exact: true })).toHaveCount(0);
  const messages: string[] = [];
  page.on('dialog', (dialog) => { messages.push(dialog.message()); });
  await page.getByRole('button', { name: 'File ▾', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(messages).toContainEqual(expect.stringContaining('Cannot save source draft:'));
  await page.getByLabel('More steps', { exact: true }).click();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('11');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Diagram step count')).toHaveValue('11');
});
