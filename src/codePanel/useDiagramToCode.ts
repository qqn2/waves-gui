import { useMemo } from 'react';
import type { DiagramState } from '../shared/types';
import { diagramToCodeString } from './codeSync';

export { diagramToCodeString };

/** Memoized diagram → formatted WaveDrom JSON string. */
export function useDiagramToCode(diagram: DiagramState): string {
  return useMemo(() => diagramToCodeString(diagram), [diagram]);
}
