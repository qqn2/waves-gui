import { describe, expect, it } from 'vitest';
import { editingShortcutForEvent, paintValueForEvent } from './shortcuts';

function keyEvent(key: string, options: Partial<KeyboardEvent> = {}) {
  return {
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...options,
  };
}

describe('editing shortcuts', () => {
  it('keeps Edge, Span, and Invert distinct, including Caps Lock input', () => {
    expect(editingShortcutForEvent(keyEvent('a'), false)?.tool).toBe('arrow');
    expect(editingShortcutForEvent(keyEvent('A'), false)?.tool).toBe('arrow');
    expect(editingShortcutForEvent(keyEvent('t'), false)?.tool).toBe('timespan');
    expect(editingShortcutForEvent(keyEvent('T'), false)?.tool).toBe('timespan');
    expect(editingShortcutForEvent(keyEvent('T', { shiftKey: true }), false))
      .toMatchObject({ tool: 'paint', paintMode: 'toggle' });
  });

  it('requires Undulate mode for extension tools and preserves their modifiers', () => {
    const arrow = keyEvent('A', { shiftKey: true });
    expect(editingShortcutForEvent(arrow, false)).toBeUndefined();
    expect(editingShortcutForEvent(arrow, true)?.tool).toBe('structured-arrow');
    expect(editingShortcutForEvent(keyEvent('d'), true)?.tool).toBe('paint');
    expect(editingShortcutForEvent(keyEvent('D', { shiftKey: true }), true)?.tool)
      .toBe('analogue-paint');
    expect(editingShortcutForEvent(keyEvent('l'), true)?.tool).toBe('vertical-line');
    expect(editingShortcutForEvent(keyEvent('L', { shiftKey: true }), true)?.tool)
      .toBe('horizontal-line');
  });

  it('does not intercept browser shortcuts, AltGr, or composition', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing'] as const) {
      expect(editingShortcutForEvent(keyEvent('a', { [modifier]: true }), true))
        .toBeUndefined();
    }
  });

  it('recognizes the timeline gap character when Shift is needed to type it', () => {
    expect(editingShortcutForEvent(keyEvent('|', { shiftKey: true }), false))
      .toMatchObject({ tool: 'paint', paintMode: 'gap' });
  });

  it('preserves the distinction between plain and arrowed clocks', () => {
    for (const key of ['p', 'P', 'n', 'N'] as const) {
      expect(paintValueForEvent(keyEvent(key))).toBe(key);
    }
    expect(paintValueForEvent(keyEvent('Z', { shiftKey: true }))).toBe('z');
    expect(paintValueForEvent(keyEvent('z', { ctrlKey: true }))).toBeUndefined();
  });
});
