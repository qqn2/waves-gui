import { expect, type Page } from '@playwright/test';

// Workflow tests opt into their tools explicitly. The canvas-first startup
// layout is covered separately so opening a panel never changes that contract.
export async function showSource(page: Page): Promise<void> {
  const toggle = page.getByTitle('Show or hide source editor', { exact: true });
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cm-content')).toBeVisible();
}

export async function showPreview(page: Page): Promise<void> {
  const toggle = page.getByTitle('Show or hide local timing diagram preview', { exact: true });
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
}

export async function showEditingPanels(page: Page): Promise<void> {
  await showSource(page);
  await showPreview(page);
}
