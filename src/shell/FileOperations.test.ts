/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import {
  forgetCurrentFileHandle,
  openDiagramFile,
  saveCurrentDiagramFile,
  saveDiagramFile,
} from './FileOperations';
import { DRAFT_STORAGE_KEY, saveDraft } from './soloDesk/localDraft';

type PickerWindow = Window & {
  showOpenFilePicker?: () => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: () => Promise<FileSystemFileHandle>;
};

describe('FileOperations', () => {
  beforeEach(() => {
    forgetCurrentFileHandle();
    localStorage.clear();
    useStore.getState().loadDiagram(createDefaultDiagram());
    delete (window as PickerWindow).showOpenFilePicker;
    delete (window as PickerWindow).showSaveFilePicker;
    vi.restoreAllMocks();
  });

  it('keeps the recovery draft and dirty state for fallback downloads', async () => {
    useStore.getState().addSignal('bit');
    const diagram = useStore.getState().diagram;
    saveDraft(diagram);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await saveDiagramFile(diagram, 'fallback.json');

    expect(useStore.getState().view.isDirty).toBe(true);
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
  });

  it('retains an opened file handle and writes back through Save', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const file = new File([
      JSON.stringify({ signal: [{ name: 'opened', wave: '01' }] }),
    ], 'opened.json', { type: 'application/json' });
    const handle = {
      name: 'opened.json',
      getFile: vi.fn().mockResolvedValue(file),
      createWritable,
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
    (window as PickerWindow).showSaveFilePicker = vi.fn();

    await openDiagramFile();
    useStore.getState().addSignal('bit');
    await saveCurrentDiagramFile();

    expect(createWritable).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect((window as PickerWindow).showSaveFilePicker).not.toHaveBeenCalled();
    expect(useStore.getState().view.isDirty).toBe(false);
  });

  it('opens commented WaveDrom JSON5 and preserves its syntax on Save', async () => {
    const source = `{
  signal: [
    // clock signal
    { name: 'clk', wave: '01' },
    // request signal
    { name: 'request', wave: '0.1' },
  ],
}`;
    const write = vi.fn().mockResolvedValue(undefined);
    const file = new File([source], 'commented.json', {
      type: 'application/json',
    });
    const handle = {
      name: 'commented.json',
      getFile: vi.fn().mockResolvedValue(file),
      createWritable: vi.fn().mockResolvedValue({
        write,
        close: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn().mockResolvedValue([
      handle,
    ]);

    await openDiagramFile();
    const clock = useStore.getState().diagram.signals[0];
    if (!clock || clock.type === 'group') return;
    useStore.getState().renameSignal(clock.id, 'system clock');
    await saveCurrentDiagramFile();

    const savedBlob = write.mock.calls[0]![0] as Blob;
    const saved = await savedBlob.text();
    expect(saved).toContain('// clock signal');
    expect(saved).toContain('// request signal');
    expect(saved).toContain("name: 'system clock'");
    expect(saved).toContain("name: 'request'");
    expect(saved).toContain('signal: [');
  });

  it('opens Undulate annotations and preserves them when saving', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const file = new File([
      JSON.stringify({
        signal: [{ name: 'opened', wave: '01' }],
        annotations: [{ text: 'Setup', x: 1.5, y: 0.5 }],
      }),
    ], 'opened.undulate.json', { type: 'application/json' });
    const handle = {
      name: 'opened.undulate.json',
      getFile: vi.fn().mockResolvedValue(file),
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    await openDiagramFile();

    expect(useStore.getState().diagram.compatibility).toMatchObject({
      extensionsEnabled: true,
      sourceFormat: 'undulate-json',
    });
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      text: 'Setup',
      tick: 1,
    });

    useStore.getState().updateTextAnnotation(
      useStore.getState().diagram.annotations![0]!.id,
      { text: 'Hold' },
    );
    await saveCurrentDiagramFile();

    const savedBlob = write.mock.calls[0]![0] as Blob;
    const saved = JSON.parse(await savedBlob.text()) as {
      annotations?: Array<{ text: string }>;
    };
    expect(saved.annotations).toEqual([
      expect.objectContaining({ text: 'Hold' }),
    ]);
  });

  it('upgrades a WaveDrom save to Undulate JSON when annotations are added', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const file = new File([
      JSON.stringify({ signal: [{ name: 'opened', wave: '01' }] }),
    ], 'opened.json', { type: 'application/json' });
    const handle = {
      name: 'opened.json',
      getFile: vi.fn().mockResolvedValue(file),
      createWritable: vi.fn().mockResolvedValue({
        write,
        close: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    await openDiagramFile();
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addTextAnnotation({ text: 'New note', tick: 0 });
    await saveCurrentDiagramFile();

    const savedBlob = write.mock.calls[0]![0] as Blob;
    const saved = JSON.parse(await savedBlob.text()) as {
      annotations?: Array<{ text: string }>;
    };
    expect(saved.annotations?.[0]?.text).toBe('New note');
  });

  it('detects and opens an Undulate analogue file without annotations', async () => {
    const file = new File([
      JSON.stringify({
        signal: [{
          name: 'vin',
          wave: '0sc',
          analogue: [0.5, 1.2],
        }],
      }),
    ], 'analogue.json', { type: 'application/json' });
    const handle = {
      name: 'analogue.json',
      getFile: vi.fn().mockResolvedValue(file),
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    await openDiagramFile();

    expect(useStore.getState().diagram.compatibility?.sourceFormat).toBe(
      'undulate-json',
    );
    expect(useStore.getState().diagram.signals[0]).toMatchObject({
      type: 'analogue',
      name: 'vin',
    });
  });

  it('rejects WIP file content without mutating the open document or handle', async () => {
    const firstFile = new File([
      JSON.stringify({ signal: [{ name: 'kept', wave: '01' }] }),
    ], 'kept.json', { type: 'application/json' });
    const firstHandle = {
      name: 'kept.json',
      getFile: vi.fn().mockResolvedValue(firstFile),
      createWritable: vi.fn(),
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn()
      .mockResolvedValueOnce([firstHandle]);
    await openDiagramFile();
    const before = useStore.getState().diagram;

    const blockedFile = new File([
      JSON.stringify({
        signal: [{
          name: 'lost',
          wave: 'p',
          repeat: 8,
          duty_cycles: [0.5],
        }],
      }),
    ], 'blocked.json', { type: 'application/json' });
    const blockedHandle = {
      name: 'blocked.json',
      getFile: vi.fn().mockResolvedValue(blockedFile),
    } as unknown as FileSystemFileHandle;
    (window as PickerWindow).showOpenFilePicker = vi.fn()
      .mockResolvedValueOnce([blockedHandle]);
    const alert = vi.fn();
    Object.defineProperty(window, 'alert', {
      configurable: true,
      value: alert,
      writable: true,
    });

    await openDiagramFile();

    expect(alert).toHaveBeenCalledWith(expect.stringContaining('[WIP] signal[0].repeat'));
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('signal[0].duty_cycles'));
    expect(useStore.getState().diagram).toBe(before);
    expect(useStore.getState().view.fileName).toBe('kept.json');
  });
});
