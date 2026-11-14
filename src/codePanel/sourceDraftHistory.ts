import { MAX_HISTORY } from '../shared/constants';

/** Text history for edits that cannot yet enter the validated diagram history. */
export class SourceDraftHistory {
  private past: string[] = [];
  private future: string[] = [];
  private text: string;
  private acceptedText: string;

  constructor(acceptedText: string, draft?: string | null) {
    this.text = acceptedText;
    this.acceptedText = acceptedText;
    if (draft != null) this.edit(draft);
  }

  edit(text: string): void {
    if (text === this.text) return;
    this.past.push(this.text);
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.text = text;
    this.future = [];
  }

  accept(text: string, preserveRedo = false): void {
    this.text = text;
    this.acceptedText = text;
    this.past = [];
    if (!preserveRedo) this.future = [];
  }

  isAccepted(text: string): boolean {
    return text === this.acceptedText;
  }

  undo(): string | undefined {
    const previous = this.past.pop();
    if (previous === undefined) return undefined;
    this.future.push(this.text);
    this.text = previous;
    return previous;
  }

  redo(): string | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(this.text);
    this.text = next;
    return next;
  }
}
