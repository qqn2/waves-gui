export interface LessonStage {
  title: string;
  /** Waveform cells [start, end); a transfer is sampled at the right-hand edge. */
  start: number;
  end: number;
  description: string;
  signals: string[];
}

export interface SampleLearningNotes {
  protocol: 'APB' | 'AHB' | 'AXI';
  order: number;
  summary: string;
  objective: string;
  stages: LessonStage[];
  signals: Array<{ name: string; meaning: string }>;
  takeaway: string;
  exercise: { question: string; answer: string };
  reference: { label: string; url: string };
}
