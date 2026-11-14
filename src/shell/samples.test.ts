// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { parseCodeToDiagram } from '../codePanel/codeSync';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import { forgetCurrentFileHandle, openDiagramFile, saveCurrentDiagramFile } from './FileOperations';
import { SAMPLE_DIAGRAMS, SAMPLE_LIBRARY, collectSampleLeaves, loadSampleDiagram } from './samples';

const samplesDir = join(process.cwd(), 'public', 'samples');

describe('sample library tree', () => {
  it('has unique leaf ids', () => {
    const ids = collectSampleLeaves().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses path-style ids for nested samples', () => {
    expect(collectSampleLeaves(SAMPLE_LIBRARY).some((s) => s.id === 'amba/apb/write')).toBe(
      true,
    );
    expect(collectSampleLeaves(SAMPLE_LIBRARY).some((s) => s.id === 'amba/axi/read')).toBe(
      true,
    );
  });
});

const source = JSON.stringify({ signal: [{ name: 'sample', wave: '01..' }] });

function pendingResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

type PickerWindow = Window & {
  showOpenFilePicker?: () => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: () => Promise<FileSystemFileHandle>;
};

describe('opening a sample copy', () => {
  beforeEach(() => {
    forgetCurrentFileHandle();
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().markClean('current.json');
    Object.defineProperty(window, 'confirm', { configurable: true, value: vi.fn().mockReturnValue(true) });
  });

  afterEach(() => {
    delete (window as PickerWindow).showOpenFilePicker;
    delete (window as PickerWindow).showSaveFilePicker;
    Reflect.deleteProperty(window, 'confirm');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps an invalid source draft and diagram when discard is declined', async () => {
    useStore.setState((state) => {
      state.view.sourceDraft = '{ unfinished';
      state.view.sourceDraftDirty = true;
    });
    const before = useStore.getState();
    vi.mocked(window.confirm).mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source)));

    expect(await loadSampleDiagram('general/handshake')).toBe(false);

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(useStore.getState()).toBe(before);
  });

  it('does not request discard or change the document when the asset is invalid', async () => {
    useStore.getState().addSignal('bit');
    const before = useStore.getState();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{ invalid')));

    await expect(loadSampleDiagram('general/handshake')).rejects.toThrow();

    expect(window.confirm).not.toHaveBeenCalled();
    expect(useStore.getState()).toBe(before);
  });

  it.each(['diagram edit', 'source edit', 'new document', 'file session'])(
    'does not overwrite a %s while the request is pending',
    async (change) => {
      const pending = pendingResponse();
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
      const loading = loadSampleDiagram('general/handshake');
      if (change === 'diagram edit') useStore.getState().addSignal('bit');
      if (change === 'source edit') useStore.setState((state) => {
        state.view.sourceDraft = '{ newer draft';
        state.view.sourceDraftDirty = true;
      });
      if (change === 'new document') useStore.getState().loadDiagram(createDefaultDiagram());
      if (change === 'file session') forgetCurrentFileHandle();
      const afterChange = useStore.getState();
      pending.resolve(new Response(source));

      expect(await loading).toBe(false);
      expect(useStore.getState()).toBe(afterChange);
      expect(window.confirm).not.toHaveBeenCalled();
    },
  );

  it('ignores a superseded request even when its response arrives last', async () => {
    const first = pendingResponse();
    const second = pendingResponse();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const older = loadSampleDiagram('general/handshake');
    const newer = loadSampleDiagram('general/data-bus');
    second.resolve(new Response(source));
    expect(await newer).toBe(true);
    const afterNewer = useStore.getState();
    first.resolve(new Response(source));

    expect(await older).toBe(false);
    expect(useStore.getState()).toBe(afterNewer);
    expect(useStore.getState().view.fileName).toBe('data-bus.json');
  });

  it('cancels after fetching even if the fetch implementation ignores the signal', async () => {
    const pending = pendingResponse();
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
    const controller = new AbortController();
    const before = useStore.getState();
    const loading = loadSampleDiagram('general/handshake', controller.signal);
    controller.abort();
    pending.resolve(new Response(source));

    expect(await loading).toBe(false);
    expect(useStore.getState()).toBe(before);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('preserves source edits made while the response body is being read', async () => {
    let finishBody!: (text: string) => void;
    const body = new Promise<string>((resolve) => { finishBody = resolve; });
    const readBody = vi.fn().mockReturnValue(body);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: readBody }));
    const loading = loadSampleDiagram('general/handshake');
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce());
    useStore.setState((state) => {
      state.view.sourceDraft = '{ newer body-time draft';
      state.view.sourceDraftDirty = true;
    });
    const afterEdit = useStore.getState();
    finishBody(source);

    expect(await loading).toBe(false);
    expect(useStore.getState()).toBe(afterEdit);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('opens a clean copy and detaches the previously opened file handle', async () => {
    const previousWrite = vi.fn();
    const handle = {
      name: 'original.json',
      getFile: vi.fn().mockResolvedValue(new File([source], 'original.json')),
      createWritable: previousWrite,
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    await openDiagramFile();
    useStore.setState((state) => {
      state.view.sourceDraftDirty = true;
      state.view.sourceDraft = '{ discard me';
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(source)));

    expect(await loadSampleDiagram('general/handshake')).toBe(true);

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(useStore.getState().view).toMatchObject({
      fileName: 'handshake.json', isDirty: false, sourceDraftDirty: false, sourceDraft: null,
    });
    const picker = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    (window as PickerWindow).showSaveFilePicker = picker;
    useStore.getState().addSignal('bit');
    await saveCurrentDiagramFile();
    expect(picker).toHaveBeenCalledOnce();
    expect(previousWrite).not.toHaveBeenCalled();
  });
});

describe('bundled sample diagrams', () => {
  it.each(SAMPLE_DIAGRAMS.map((s) => [s.id, s.file] as const))(
    '%s validates and imports',
    (_id, file) => {
      const raw = readFileSync(join(samplesDir, file), 'utf8');
      const parsed = parseCodeToDiagram(raw);
      expect(parsed.ok).toBe(true);
      if (parsed.ok === false) throw new Error(parsed.error);
      const diagram = parsed.diagram;
      expect(diagram.signals.length).toBeGreaterThan(0);
      expect(diagram.config.totalSteps).toBeGreaterThan(0);
    },
  );

  it('includes task-oriented coverage for the major Undulate workflows', () => {
    const ids = collectSampleLeaves().map((sample) => sample.id);
    expect(ids).toEqual(expect.arrayContaining([
      'undulate/fine-timing',
      'undulate/analogue',
      'undulate/annotations',
      'undulate/states-and-style',
    ]));
  });
});
