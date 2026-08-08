import {
  DEFAULT_ANALOGUE_CONTEXT,
  evaluateUndulateSequence,
  type AnalogueContext,
} from '../shared/analogueExpressions';
import type { WdSignal, WdSignalEntry } from '../wavedromBridge';
import type { UndulateRoot } from './types';

export type GeneratedSequenceField = 'analogue' | 'periods' | 'duty_cycles';

export interface GeneratedSequenceSource {
  source: string;
  values: number[];
  fingerprint: string;
}

export type GeneratedSequenceSources = Partial<
  Record<GeneratedSequenceField, GeneratedSequenceSource>
>;

export interface ResolvedUndulateSequences {
  root: UndulateRoot;
  sources: Array<GeneratedSequenceSources | undefined>;
}

export function generatedSequenceFingerprint(values: readonly number[]): string {
  return JSON.stringify(values);
}

export function analogueContextForUndulateRoot(root: UndulateRoot): AnalogueContext {
  const context = root['x-waves-gui']?.analogueContext;
  return context
    && Number.isFinite(context.vssa)
    && Number.isFinite(context.vdda)
    && context.vdda > context.vssa
    ? { vssa: context.vssa, vdda: context.vdda }
    : { ...DEFAULT_ANALOGUE_CONTEXT };
}

function isSignalEntry(entry: WdSignalEntry): entry is WdSignal {
  return !Array.isArray(entry) && Object.keys(entry).length > 0;
}

function resolveField(
  signal: WdSignal,
  field: GeneratedSequenceField,
  context: AnalogueContext,
  sources: GeneratedSequenceSources,
): void {
  const value = signal[field];
  if (typeof value !== 'string') return;
  const values = evaluateUndulateSequence(value, context);
  signal[field] = values;
  sources[field] = {
    source: value,
    values,
    fingerprint: generatedSequenceFingerprint(values),
  };
}

export function resolveUndulateGeneratedSequences(
  input: UndulateRoot,
): ResolvedUndulateSequences {
  const root = JSON.parse(JSON.stringify(input)) as UndulateRoot;
  const context = analogueContextForUndulateRoot(root);
  const sources: Array<GeneratedSequenceSources | undefined> = [];
  const walk = (entries: WdSignalEntry[]): void => {
    for (const entry of entries) {
      if (Array.isArray(entry)) {
        walk(entry.slice(1) as WdSignalEntry[]);
        continue;
      }
      if (!isSignalEntry(entry)) continue;
      const generated: GeneratedSequenceSources = {};
      resolveField(entry, 'analogue', context, generated);
      if (entry.analogue === undefined) {
        resolveField(entry, 'periods', context, generated);
        resolveField(entry, 'duty_cycles', context, generated);
      }
      sources.push(Object.keys(generated).length > 0 ? generated : undefined);
    }
  };
  walk(root.signal);
  return { root, sources };
}
