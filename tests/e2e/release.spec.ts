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

function signalRow(page: Page, name: string) {
  return page.locator('[data-signal-row="true"]').filter({ hasText: name }).first();
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
  expect((await page.locator('canvas').boundingBox())!.height).toBeGreaterThanOrEqual(120);
  await expect(page.getByTitle('Show or hide WaveDrom render preview')).toHaveAttribute('aria-pressed', 'true');
  const preview = page.getByText('WaveDrom render (local)', { exact: true })
    .locator('..')
    .locator('svg');
  await expect(preview).toBeVisible();
  await expect(preview.locator('style')).toContainText('.s1{fill:none;stroke:#000');
  expect(await preview.locator('.s5').first().evaluate((element) => (
    getComputedStyle(element).fill
  ))).toBe('rgb(255, 255, 255)');
  await expect(page.getByRole('button', { name: 'Web', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Axis', exact: true })).toHaveCount(0);
  await expect(page.locator('a[href*="wavedrom.com/editor"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('round-trips Undulate canvas edits through JSON and the local render', async ({ page }) => {
  await page.getByLabel('Undulate extensions').check();
  await page.getByRole('button', { name: 'Analog', exact: true }).click();

  const editor = page.locator('.cm-content');
  await expect(page.getByText('Undulate JSON', { exact: true })).toBeVisible();
  await expect(editor).toContainText('"analogue"');
  const preview = page.getByText('Undulate render (local)', { exact: true })
    .locator('..');
  await expect(preview.locator('svg')).toBeVisible();
  await expect(preview.locator('svg')).toContainText('analog');

  await replaceJson(page, JSON.stringify({
    signal: [
      {
        name: 'supply',
        wave: 'sc.',
        analogue: [0.6, 1.2],
        slewing: 4,
      },
    ],
    annotations: [
      { text: 'Settled', x: 1.125, y: 0.375, fill: '#123456' },
      { shape: '|', x: 2.5 },
      {
        shape: '||',
        x: 0.5,
        stroke: '#ff0000',
        'stroke-width': 2,
        'stroke-dasharray': [3, 2],
      },
    ],
  }, null, 2));

  await expect(signalRow(page, 'supply')).toBeVisible();
  await expect(preview.locator('svg')).toContainText('Settled');
  await expect(editor).toContainText('"slewing": 4');
  await expect(editor).toContainText('"shape": "||"');
  await expect(editor).toContainText('"x": 1.125');
  await expect(editor).toContainText('"y": 0.375');
  await expect(preview.locator('text[fill="#123456"]')).toContainText('Settled');
  await expect(preview.locator('line[stroke="#ff0000"]')).toHaveCount(2);

  const renderScale = page.getByLabel('Local render scale controls');
  await expect(renderScale.getByRole('button', { name: 'Fit', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await renderScale.getByRole('button', { name: '100%', exact: true }).click();
  await expect(preview.locator('svg')).toHaveCSS('max-width', 'none');
  await renderScale.getByRole('button', { name: 'Fit', exact: true }).click();
  await expect(preview.locator('svg')).toHaveCSS('max-width', '100%');
});

test('round-trips and renders Undulate extended digital states', async ({ page }) => {
  await page.getByLabel('Undulate extensions').check();
  const wave = '01.zx=ud.2.3.45XziIzmzM';
  await replaceJson(page, JSON.stringify({
    signal: [{ name: 'digital', wave }],
  }, null, 2));

  const preview = page.getByText('Undulate render (local)', { exact: true })
    .locator('..');
  await expect(signalRow(page, 'digital')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText(wave);
  await expect(preview.locator('path[data-wave-state="i"]')).toHaveCount(1);
  await expect(preview.locator('path[data-wave-state="I"]')).toHaveCount(1);
  await expect(preview.locator('path[data-wave-state="m"]')).toHaveCount(1);
  await expect(preview.locator('path[data-wave-state="M"]')).toHaveCount(1);
  await expect(preview.locator('path[data-wave-state="2"]')).toHaveCount(1);
  await expect(preview.locator('path[data-wave-state="3"]')).toHaveCount(1);
  await expect(preview.locator('path[data-wave-state="X"]')).toHaveCount(1);
});

test('renders held bit and vector pipe gaps in the local Undulate preview', async ({ page }) => {
  await page.getByLabel('Undulate extensions').check();
  await replaceJson(page, JSON.stringify({
    signal: [
      {
        name: 'enable',
        wave: '0..1|.0',
      },
      {
        name: 'bus',
        wave: 'x.3|.5x',
        data: 'head body tail',
      },
    ],
  }, null, 2));

  const preview = page.getByText('Undulate render (local)', { exact: true })
    .locator('..');
  await expect(signalRow(page, 'enable')).toBeVisible();
  await expect(signalRow(page, 'bus')).toBeVisible();
  await expect(preview.locator('svg')).toBeVisible();
  await expect(preview.locator('path[d^="M-3.5,-2"]')).toHaveCount(2);
  const heldBitTrace = preview.locator('path[stroke-width="2"]').filter({
    hasNot: page.locator('[fill]'),
  }).first();
  await expect(heldBitTrace).toHaveAttribute('d', /L200,/);
});

test('offers preserve, cancel, and remove choices when hiding Undulate', async ({ page }) => {
  const toggle = page.getByLabel('Undulate extensions');
  const editor = page.locator('.cm-content');
  await toggle.check();
  await page.getByRole('button', { name: 'Analog', exact: true }).click();
  await expect(editor).toContainText('"analogue"');

  await toggle.click();
  let dialog = page.getByRole('dialog', { name: 'Turn off Undulate?' });
  await expect(dialog).toContainText('1 analogue signal');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(editor).toContainText('"analogue"');

  await toggle.click();
  dialog = page.getByRole('dialog', { name: 'Turn off Undulate?' });
  await dialog.getByRole('button', {
    name: 'Hide features and preserve JSON',
    exact: true,
  }).click();
  await expect(toggle).not.toBeChecked();
  await expect(editor).toContainText('"analogue"');
  await expect(
    page.getByText('WaveDrom compatibility render (local)', { exact: true }),
  ).toBeVisible();

  await toggle.check();
  await toggle.click();
  dialog = page.getByRole('dialog', { name: 'Turn off Undulate?' });
  await dialog.getByRole('button', {
    name: 'Remove Undulate features',
    exact: true,
  }).click();
  await expect(toggle).not.toBeChecked();
  await expect(editor).not.toContainText('"analogue"');
  await expect(page.getByText('WaveDrom JSON', { exact: true })).toBeVisible();
});

test('appends an Undulate section after the core toolbar sections', async ({ page }) => {
  const toolbar = page.getByLabel('Waveform editing tools');
  const coreTools = toolbar.getByRole('group', { name: 'Tools', exact: true });
  const insertTools = toolbar.getByRole('group', { name: 'Insert', exact: true });
  const titlesIn = (group: typeof coreTools) => group
    .locator('button[title]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('title')));

  await expect(toolbar.locator(':scope > [role="group"] > span:first-child')).toHaveText([
    'Tools',
    'Insert',
  ]);
  await expect.poll(() => titlesIn(coreTools)).toEqual([
    'Select (V)',
    'Draw (D)',
    'Erase (E)',
    'Edge (A)',
    'Span (T)',
  ]);
  await expect(
    toolbar.getByRole('group', { name: 'Undulate', exact: true }),
  ).toHaveCount(0);

  await page.getByLabel('Undulate extensions').check();
  const undulateTools = toolbar.getByRole('group', {
    name: 'Undulate',
    exact: true,
  });
  await expect(toolbar.locator(':scope > [role="group"] > span:first-child')).toHaveText([
    'Tools',
    'Insert',
    'Undulate',
  ]);
  await expect.poll(() => titlesIn(undulateTools)).toEqual([
    'Text (I)',
    'V line (L)',
    'H line (Shift+L)',
    'Compress (Shift+C)',
  ]);

  await expect(insertTools.locator('button span')).toHaveText([
    'Signal',
    'Bus',
    'Group',
  ]);
  await expect(undulateTools.locator('button span')).toHaveText([
    'Text',
    'V line',
    'H line',
    'Compress',
    'Analog',
  ]);
});

test('deletes a section from its actions menu and restores it with undo', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add signal', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Section (group)', exact: true }).click();

  const section = page.locator('[data-group-row="true"]').filter({
    hasText: 'Section',
  });
  await expect(section).toBeVisible();
  await section.getByRole('button', { name: 'Section actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete section', exact: true }).click();
  await expect(section).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(section).toBeVisible();
});

test('keeps signal names aligned with their waveform rows', async ({ page }) => {
  const canvasBox = await page.getByRole('grid', { name: /Waveform editor/ }).boundingBox();
  const firstSignalBox = await signalRow(page, 'clk').boundingBox();

  expect(canvasBox).not.toBeNull();
  expect(firstSignalBox).not.toBeNull();
  expect(Math.abs(firstSignalBox!.y - canvasBox!.y - 48)).toBeLessThanOrEqual(1);
});

test('keeps waveform pixels aligned at fractional Windows display scaling', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => 1.25,
    });
  });
  await page.reload();

  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const label = document.querySelector<HTMLElement>('[data-signal-row="true"]');
    if (!canvas || !label) throw new Error('waveform geometry unavailable');
    const canvasRect = canvas.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const ratio = canvas.width / canvas.clientWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const rowTop = Math.floor((labelRect.top - canvasRect.top) * ratio);
    const rowBottom = Math.ceil((labelRect.bottom - canvasRect.top) * ratio);
    let minBlueY = Number.POSITIVE_INFINITY;
    let maxBlueY = Number.NEGATIVE_INFINITY;
    for (let y = Math.max(0, rowTop); y < Math.min(canvas.height, rowBottom); y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const r = pixels[i] ?? 0;
        const g = pixels[i + 1] ?? 0;
        const b = pixels[i + 2] ?? 0;
        if (b > 160 && b > r * 1.4 && b > g * 1.25) {
          minBlueY = Math.min(minBlueY, y);
          maxBlueY = Math.max(maxBlueY, y);
        }
      }
    }
    return {
      ratio,
      labelCenter: (labelRect.top + labelRect.bottom) / 2,
      waveCenter: canvasRect.top + (minBlueY + maxBlueY) / (2 * ratio),
    };
  });

  expect(geometry.ratio).toBeCloseTo(1.25, 1);
  expect(Math.abs(geometry.labelCenter - geometry.waveCenter)).toBeLessThanOrEqual(1.5);
});

test('uses consistent editing rail controls and a readable skin selector', async ({ page }) => {
  const editingModes = [
    page.locator('button[title^="Draw (D)"]'),
    page.locator('button[title^="Erase (E)"]'),
    page.locator('button[title^="Select (V)"]'),
    page.locator('button[title^="Edge (A)"]'),
    page.locator('button[title^="Span (T)"]'),
  ];
  const boxes = await Promise.all(editingModes.map((control) => control.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeGreaterThanOrEqual(48);
  }

  const skinBox = await page.getByLabel('WaveDrom skin').boundingBox();
  expect(skinBox).not.toBeNull();
  expect(skinBox!.height).toBeCloseTo(32, 3);
  expect(skinBox!.width).toBeGreaterThanOrEqual(80);

  const desktopChrome = await page.locator('button[title^="Draw (D)"]').evaluate((button) => ({
    buttonRadius: getComputedStyle(button).borderRadius,
    bodyFont: getComputedStyle(document.body).fontFamily,
  }));
  expect(desktopChrome.buttonRadius).toBe('3px');
  expect(desktopChrome.bodyFont).toContain('Segoe UI');
  await expect(signalRow(page, 'clk').getByText('BIT', { exact: true })).toHaveCSS('border-radius', '2px');
  for (const operation of ['Glitch', 'Gap', 'Invert']) {
    const button = page.getByRole('button', { name: operation, exact: true });
    await expect(button).toBeVisible();
    await expect(button.locator('svg')).toHaveCount(1);
  }
});

test('applies visible text scaling and a real dark theme', async ({ page }) => {
  await page.getByTitle('Appearance').click();
  const sample = page.getByRole('button', { name: /File/ });

  await page.getByRole('button', { name: 'M', exact: true }).click();
  const medium = Number.parseFloat(await sample.evaluate((element) => getComputedStyle(element).fontSize));
  await page.getByRole('button', { name: 'L', exact: true }).click();
  const large = Number.parseFloat(await sample.evaluate((element) => getComputedStyle(element).fontSize));
  await page.getByRole('button', { name: 'S', exact: true }).click();
  const small = Number.parseFloat(await sample.evaluate((element) => getComputedStyle(element).fontSize));

  expect(large).toBeGreaterThan(medium);
  expect(small).toBeLessThan(medium);

  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      app: style.getPropertyValue('--bg-app').trim(),
      panel: style.getPropertyValue('--bg-panel').trim(),
      canvas: style.getPropertyValue('--bg-canvas').trim(),
      text: style.getPropertyValue('--text-primary').trim(),
    };
  });
  expect(colors).toEqual({
    app: '#17191d',
    panel: '#23272d',
    canvas: '#111418',
    text: '#f3f5f7',
  });
  await expect.poll(() => page.locator('canvas').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    if (!context || canvas.width < 2 || canvas.height < 2) return [];
    return Array.from(context.getImageData(canvas.width - 2, canvas.height - 2, 1, 1).data.slice(0, 3));
  })).toEqual([17, 20, 24]);
});

test('keeps bus segment editing exclusively in the selected signal inspector', async ({ page }) => {
  await expect(page.getByLabel('Properties inspector')).toHaveCount(0);
  await expect(page.getByLabel('Signals panel').getByLabel('Bus segment labels')).toHaveCount(0);
  await expect(
    page.getByTitle('Select a signal or annotation to inspect its properties'),
  ).toBeDisabled();

  await replaceJson(page, JSON.stringify({
    signal: [
      { name: 'control', wave: '01....' },
      { name: 'payload', wave: '=.=.=.', data: ['A5', '5A', 'FF'] },
      { name: 'address', wave: '=.....', data: ['1000'] },
    ],
  }, null, 2));

  await signalRow(page, 'payload').click();
  const inspector = page.getByLabel('Properties inspector');
  const segments = inspector.getByLabel('Bus segment labels');
  await expect(inspector).toBeVisible();
  await expect(segments).toBeVisible();
  await expect(page.getByLabel('Signals panel').getByLabel('Bus segment labels')).toHaveCount(0);
  const widths = await Promise.all([inspector.boundingBox(), segments.boundingBox()]);
  expect(widths[0]).not.toBeNull();
  expect(widths[1]!.width).toBeGreaterThan(widths[0]!.width * 0.9);
  await expect(inspector.getByLabel('Signal inspector details')).toHaveCSS('overflow-y', 'auto');
  await expect(page.getByTitle('Show or hide properties inspector')).toBeEnabled();
  await expect(segments.getByLabel('Label for steps 0 to 2')).toHaveValue('A5');
  await expect(segments.getByLabel('Label for steps 2 to 4')).toHaveValue('5A');
  await expect(segments.getByLabel('Label for steps 4 to 6')).toHaveValue('FF');

  const firstLabel = segments.getByLabel('Label for steps 0 to 2');
  await firstLabel.fill('A6');
  await firstLabel.press('Enter');
  await expect(firstLabel).toHaveValue('A6');
  await expect(page.locator('.cm-content')).toContainText('A6');

  const busLabel = inspector.getByLabel('Bus label');
  await expect(busLabel).toHaveValue('data');
  await busLabel.fill('A5 payload');

  await page.getByRole('button', { name: 'Close signal inspector' }).click();
  await expect(page.getByLabel('Properties inspector')).toHaveCount(0);
  await expect(page.getByRole('banner').getByLabel('Bus label')).toHaveCount(0);

  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(page.getByLabel('Properties inspector')).toBeVisible();
  await expect(page.getByLabel('Properties inspector').getByLabel('Bus label')).toHaveValue('A5 payload');

  await signalRow(page, 'address').click();
  await expect(page.getByLabel('Properties inspector').getByLabel('Bus segment labels')).toBeVisible();
  await expect(page.getByLabel('Label for steps 0 to 6')).toHaveValue('1000');
  await expect(page.getByLabel('Label for steps 0 to 2')).toHaveCount(0);

  await signalRow(page, 'control').click();
  await expect(page.getByLabel('Properties inspector')).toBeVisible();
  await expect(page.getByLabel('Bus segment labels')).toHaveCount(0);
});

test('keeps narrow view controls separated instead of shrinking labels together', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 760 });

  const controls = [
    page.getByTitle('Show or hide WaveDrom JSON editor'),
    page.getByTitle('Show or hide WaveDrom render preview'),
    page.getByRole('button', { name: 'Inspector', exact: true }),
    page.getByLabel('WaveDrom skin'),
  ];
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  for (const box of boxes) expect(box).not.toBeNull();
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index]!.x).toBeGreaterThanOrEqual(
      boxes[index - 1]!.x + boxes[index - 1]!.width,
    );
  }
});

test('separates document controls from tool options at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1222, height: 912 });

  const primary = await page.locator('[data-toolbar="primary"]').boundingBox();
  const context = await page.locator('[data-toolbar="context"]').boundingBox();
  expect(primary).not.toBeNull();
  expect(context).not.toBeNull();
  expect(primary!.height).toBeLessThanOrEqual(48);
  expect(context!.y).toBeGreaterThanOrEqual(primary!.y + primary!.height - 1);

  const viewControls = [
    page.getByTitle('Show or hide WaveDrom JSON editor'),
    page.getByTitle('Show or hide WaveDrom render preview'),
    page.getByRole('button', { name: 'Inspector', exact: true }),
    page.getByLabel('WaveDrom skin'),
  ];
  const boxes = await Promise.all(viewControls.map((control) => control.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(primary!.y);
    expect(box!.y + box!.height).toBeLessThanOrEqual(primary!.y + primary!.height + 1);
  }
  expect(boxes[0]!.width).toBeGreaterThanOrEqual(54);
  expect(boxes[1]!.width).toBeGreaterThanOrEqual(64);
  expect(boxes[2]!.width).toBeGreaterThanOrEqual(78);
});

test('detects clipped signal names and clears the tooltip after resize', async ({ page }) => {
  const longName = 'memory_controller_status';
  await replaceJson(page, JSON.stringify({
    signal: [{ name: longName, wave: '01..' }],
  }));

  const name = signalRow(page, longName).locator('[data-overflow]');
  await expect(name).toHaveAttribute('data-overflow', 'true');
  await expect(name).toHaveAttribute('title', longName);

  const handle = page.getByTitle('Resize signal name column');
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
  await page.mouse.down();
  await page.mouse.move(box!.x + 390, box!.y + 40, { steps: 8 });
  await page.mouse.up();

  await expect(name).toHaveAttribute('data-overflow', 'false');
  await expect(name).not.toHaveAttribute('title', longName);
});

test('synchronizes JSON, supports undo/redo, and restores the local draft', async ({ page }) => {
  await replaceJson(page, editedDiagram);
  await expect(signalRow(page, 'safe_bus')).toBeVisible();
  await page.waitForTimeout(1_200);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wavedrom-gui-draft'))).not.toBeNull();

  const steps = page.getByLabel('Diagram step count');
  const before = await steps.inputValue();
  await page.getByLabel('More steps').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(steps).toHaveValue(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(steps).toHaveValue(String(Number(before) + 1));

  const recoveryDialogs: string[] = [];
  page.on('dialog', (dialog) => {
    if (dialog.message().includes('Restore it and replace the current diagram')) {
      recoveryDialogs.push(dialog.message());
    }
  });
  await page.reload();
  await expect(signalRow(page, 'safe_bus')).toBeVisible();
  expect(recoveryDialogs).toEqual([]);
});

test('retains WaveDrom JSON5 comments through GUI edits and undo', async ({ page }) => {
  const commentedSource = `{ signal : [
  // clock signal
  { name: "clk", wave: "p......" },
  // bus data
  { name: "bus", wave: "x.34.5x", data: "head body tail" },
  // request signal
  { name: "wire", wave: "0.1..0." },
] }`;
  const editor = page.locator('.cm-content');

  await replaceJson(page, commentedSource);
  await expect(page.getByText('✓ Valid', { exact: true })).toBeVisible();
  await expect(signalRow(page, 'bus')).toBeVisible();

  await page.getByLabel('More steps').click();
  await expect(editor).toContainText('// clock signal');
  await expect(editor).toContainText('// bus data');
  await expect(editor).toContainText('// request signal');
  await expect(editor).toContainText('p.......');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(editor).toContainText('// clock signal');
  await expect(editor).toContainText('p......');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(editor).toContainText('// request signal');
  await expect(editor).toContainText('p.......');
});

test('raw JSON edits are dirty and participate in unified undo/redo', async ({ page }) => {
  await replaceJson(page, editedDiagram);
  await expect(signalRow(page, 'safe_bus')).toBeVisible();
  await expect(page.getByText('unsaved', { exact: true })).toBeVisible();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await expect(signalRow(page, 'safe_bus')).toHaveCount(0);
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(signalRow(page, 'safe_bus')).toBeVisible();
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
  await expect(signalRow(page, 'safe_bus')).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Open JSON/VCD…', exact: true }).click();
  await expect(signalRow(page, 'opened_handle')).toBeVisible();
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

  await expect(page.locator('[role="alert"]').filter({
    hasText: 'Invalid JSON/JSON5 syntax',
  })).toBeVisible();
  await expect(signalRow(page, 'clk')).toBeVisible();
  await expect(steps).toHaveValue(before);
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(signalRow(page, 'clk')).toBeVisible();
  await expect(steps).toHaveValue(before);
});

test('WIP and unknown Undulate properties report together without data loss', async ({ page }) => {
  const steps = page.getByLabel('Diagram step count');
  const before = await steps.inputValue();
  await replaceJson(page, JSON.stringify({
    signal: [{
      name: 'blocked',
      wave: 'p',
      repeat: 8,
      duty_cycles: [0.5],
      future_lane: true,
    }],
    edges: ['a->b'],
  }, null, 2));

  const report = page.locator('[role="alert"]').filter({
    hasText: '[WIP] signal[0].repeat',
  });
  await expect(report).toContainText('[WIP] signal[0].duty_cycles');
  await expect(report).toContainText('Unknown Undulate property signal[0].future_lane');
  await expect(report).toContainText('[WIP] edges');
  await expect(signalRow(page, 'clk')).toBeVisible();
  await expect(signalRow(page, 'blocked')).toHaveCount(0);
  await expect(steps).toHaveValue(before);
  await expect(page.getByText('unsaved', { exact: true })).toHaveCount(0);
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
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/qqn2/waves-gui');
  await expect(page.getByRole('link', { name: 'Report a bug' })).toHaveAttribute(
    'href',
    'https://github.com/qqn2/waves-gui/issues/new?template=bug_report.yml',
  );
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
  const previewRoot = page.getByText('WaveDrom render (local)', { exact: true }).locator('..');
  await expect(previewRoot.locator('script, foreignObject, image')).toHaveCount(0);
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
