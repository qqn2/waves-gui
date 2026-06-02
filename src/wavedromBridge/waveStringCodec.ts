import { BIT_STATE_CHARS, type BitState } from '../shared/types';
import {
  decodeClockWave,
  decodeExpandedClockWave,
  encodeClockWaveString,
  isClockWaveString,
} from './clockWave';

export interface DecodedWave {
  states: BitState[];
  stepGaps: boolean[];
  stepGlitches: boolean[];
}

function waveCharToBitState(char: string): BitState | null {
  switch (char) {
    case '0':
      return '0';
    case '1':
      return '1';
    case 'x':
    case 'X':
      return 'x';
    case 'z':
    case 'Z':
      return 'z';
    case 'u':
    case 'U':
      return 'u';
    case 'd':
    case 'D':
      return 'd';
    default:
      return null;
  }
}

function markGlitch(stepGlitches: boolean[], boundaryIndex: number): void {
  if (boundaryIndex >= 0) stepGlitches[boundaryIndex] = true;
}

export function decodeWaveDetail(wave: string): DecodedWave {
  if (isClockWaveString(wave)) {
    return decodeClockWave(wave);
  }

  const expanded = decodeExpandedClockWave(wave);
  if (expanded) return expanded;

  const states: BitState[] = [];
  const stepGaps: boolean[] = [];
  const stepGlitches: boolean[] = [];
  let prev: BitState = '0';
  let lastWaveChar = '';

  for (const char of wave) {
    switch (char) {
      case '|':
        if (states.length > 0) stepGaps[states.length - 1] = true;
        lastWaveChar = char;
        break;
      case '.':
        states.push(prev);
        lastWaveChar = char;
        break;
      case '0':
      case '1':
      case 'x':
      case 'X':
      case 'z':
      case 'Z':
      case 'u':
      case 'U':
      case 'd':
      case 'D': {
        const next = waveCharToBitState(char)!;
        if (states.length === 0) {
          states.push(next);
          prev = next;
        } else if (next === prev) {
          if (lastWaveChar === '.') {
            markGlitch(stepGlitches, states.length - 2);
          } else {
            states.push(next);
            markGlitch(stepGlitches, states.length - 2);
          }
        } else {
          states.push(next);
          prev = next;
        }
        lastWaveChar = char;
        break;
      }
      case 'p':
        states.push('p');
        prev = 'p';
        lastWaveChar = char;
        break;
      case 'P':
        states.push('P');
        prev = 'P';
        lastWaveChar = char;
        break;
      case 'n':
        states.push('n');
        prev = 'n';
        lastWaveChar = char;
        break;
      case 'N':
        states.push('N');
        prev = 'N';
        lastWaveChar = char;
        break;
      case '=':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        states.push('0');
        prev = '0';
        lastWaveChar = char;
        break;
      default:
        break;
    }
  }

  return { states, stepGaps, stepGlitches };
}

export function decodeWaveString(wave: string): BitState[] {
  return decodeWaveDetail(wave).states;
}

/** Canonical WaveDrom wave string (holds use `.`; glitches are not preserved). */
export function normalizeWaveString(wave: string): string {
  const { states, stepGaps } = decodeWaveDetail(wave);
  return encodeWaveString(states, stepGaps);
}

export function encodeWaveString(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string {
  if (states.length === 0) return '';
  const clockWave = encodeClockWaveString(states, stepGaps, stepGlitches);
  if (clockWave !== null) return clockWave;

  let wave = BIT_STATE_CHARS[states[0]!];
  for (let i = 1; i < states.length; i++) {
    const ch = BIT_STATE_CHARS[states[i]!];
    const prevCh = BIT_STATE_CHARS[states[i - 1]!];
    if (stepGaps?.[i - 1]) {
      wave += '|';
    } else if (stepGlitches?.[i - 1]) {
      wave += ch;
    } else if (ch === prevCh) {
      wave += '.';
    } else {
      wave += ch;
    }
  }
  return wave;
}
