import { describe, expect, it } from 'vitest';
import { SourceDraftHistory } from './sourceDraftHistory';

describe('invalid source draft history', () => {
  it('undoes incomplete edits and can redo them across a valid checkpoint', () => {
    const history = new SourceDraftHistory('{}');
    history.edit('{');
    history.edit('');
    expect(history.undo()).toBe('{');
    expect(history.undo()).toBe('{}');
    expect(history.isAccepted('{}')).toBe(true);
    expect(history.isAccepted('{')).toBe(false);
    history.accept('{}', true);
    expect(history.undo()).toBeUndefined();
    expect(history.redo()).toBe('{');
    expect(history.redo()).toBe('');
  });

  it('drops text redo after typing or an external document change', () => {
    const history = new SourceDraftHistory('{}');
    history.edit('{');
    history.undo();
    history.edit('{ signal: [] }');
    expect(history.redo()).toBeUndefined();
    history.undo();
    history.accept('{ signal: [{ name: "new" }] }');
    expect(history.redo()).toBeUndefined();
    expect(history.undo()).toBeUndefined();
  });

  it('lets a restored invalid source return to its last valid diagram', () => {
    const history = new SourceDraftHistory('{}', '{broken');
    expect(history.undo()).toBe('{}');
    expect(history.redo()).toBe('{broken');
  });
});
