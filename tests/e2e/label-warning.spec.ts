import { expect, test, type Page } from '@playwright/test';
import { showSource } from './helpers/editor-panels';

async function loadLabel(page: Page, label: string) {
  await page.goto('/');
  await showSource(page);
  const editor = page.locator('.cm-content');
  await editor.click();
  await editor.press('Control+a');
  await page.keyboard.insertText(JSON.stringify({ signal: [{ name: 'payload', wave: '=...', data: [label] }], config: { hscale: 1 } }));
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
  const warning = page.locator('summary').filter({ hasText: 'Label needs more space' });
  await expect(warning).toBeVisible();
  return { editor, warning };
}

test('explains yellow warnings and widens columns without changing signal timing', async ({ page }) => {
  const { editor, warning } = await loadLabel(page, 'PAYLOAD_VALUE_0123456789_ABCD');
  const before = JSON.parse(await editor.innerText());
  await warning.click();
  const explanation = page.getByRole('group', { name: 'Bus label warning' });
  await expect(explanation).toContainText('Yellow outlines');
  await expect(explanation).toContainText('diagram and exports');
  await expect(explanation).toContainText('Timing stays the same');
  await page.keyboard.press('Escape');
  await expect(explanation).not.toBeVisible();
  await expect(warning).toBeFocused();
  await warning.click();
  await page.getByLabel('Current filename', { exact: true }).click();
  await expect(explanation).not.toBeVisible();
  await warning.click();
  await explanation.getByRole('button', { name: 'Increase hscale', exact: true }).click();
  await expect(warning).toHaveCount(0);
  const after = JSON.parse(await editor.innerText());
  expect(after.signal).toEqual(before.signal);
  expect(after.config.hscale).toBeGreaterThan(before.config.hscale);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(warning).toBeVisible();
});

test('explains labels that cannot fit and opens the affected bus inspector', async ({ page }) => {
  const label = 'LONG_LABEL_'.repeat(40);
  const { warning } = await loadLabel(page, label);
  await warning.click();
  const explanation = page.getByRole('group', { name: 'Bus label warning' });
  await expect(explanation).toContainText('cannot fit at the maximum hscale');
  await explanation.getByRole('button', { name: 'Increase hscale', exact: true }).click();
  await expect(warning).toBeVisible();
  await expect(explanation.getByRole('button', { name: 'Increase hscale', exact: true })).toBeDisabled();
  await explanation.getByRole('button', { name: 'Edit bus labels', exact: true }).click();
  await expect(explanation).not.toBeVisible();
  const inspector = page.getByLabel('Properties inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector.getByLabel('Label for steps 0 to 4')).toHaveValue(label);
  await expect(inspector).toContainText('shorten label or widen span');
});

test('widening does not overwrite an invalid source draft', async ({ page }) => {
  const { editor, warning } = await loadLabel(page, 'PAYLOAD_VALUE_0123456789_ABCD');
  await editor.click();
  await editor.press('Control+End');
  await editor.press('Backspace');
  const invalid = await editor.innerText();
  await warning.click();
  await page.getByRole('group', { name: 'Bus label warning' }).getByRole('button', { name: 'Increase hscale', exact: true }).click();
  await expect(editor).toHaveText(invalid, { useInnerText: true });
  await expect(warning).toBeVisible();
  await page.getByRole('button', { name: 'Diagram settings', exact: true }).click();
  await expect(page.getByLabel('hscale', { exact: true })).toHaveValue('1');
});
