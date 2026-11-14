import { APB_LESSONS } from './apbLessons';
import { AXI_AHB_LESSONS } from './axiAhbLessons';
import type { SampleLearningNotes } from './learningTypes';

export type { SampleLearningNotes } from './learningTypes';

/** Original teaching traces, ordered from basic transfers to waits and responses. */
export const SAMPLE_LEARNING_NOTES: Record<string, SampleLearningNotes> = {
  ...APB_LESSONS,
  ...AXI_AHB_LESSONS,
};

export function protocolLessons(protocol: SampleLearningNotes['protocol']) {
  return Object.entries(SAMPLE_LEARNING_NOTES)
    .filter(([, lesson]) => lesson.protocol === protocol)
    .sort(([, a], [, b]) => a.order - b.order);
}
