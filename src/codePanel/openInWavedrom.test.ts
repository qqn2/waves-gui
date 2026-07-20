/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWavedromEditorUrl,
  confirmAndOpenInWavedrom,
  WAVEDROM_DATA_WARNING,
  WAVEDROM_EDITOR_BASE_URL,
} from './openInWavedrom';

describe('open in WaveDrom Editor', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn());
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('puts the complete JSON in an encoded query', () => {
    const code = '{"signal":[{"name":"clk & data #1","wave":"p..."}]}';
    const url = buildWavedromEditorUrl(code);

    expect(url).toBe(`${WAVEDROM_EDITOR_BASE_URL}?${encodeURIComponent(code)}`);
    expect(decodeURIComponent(url.slice(url.indexOf('?') + 1))).toBe(code);
  });

  it('does not open the external editor when the warning is declined', () => {
    const confirm = vi.mocked(window.confirm).mockReturnValue(false);
    const open = vi.mocked(window.open).mockReturnValue(null);

    expect(confirmAndOpenInWavedrom('{"signal":[]}')).toBe(false);
    expect(confirm).toHaveBeenCalledWith(WAVEDROM_DATA_WARNING);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens an isolated tab only after the warning is accepted', () => {
    const code = '{"signal":[]}';
    vi.mocked(window.confirm).mockReturnValue(true);
    const open = vi.mocked(window.open).mockReturnValue(null);

    expect(confirmAndOpenInWavedrom(code)).toBe(true);
    expect(open).toHaveBeenCalledWith(
      buildWavedromEditorUrl(code),
      '_blank',
      'noopener,noreferrer',
    );
  });
});
