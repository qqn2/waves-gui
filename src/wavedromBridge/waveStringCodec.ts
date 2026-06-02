import type { BitState } from '../shared/types';

export interface DecodedWave {
  states: BitState[];
  stepGaps: boolean[];
}

export function decodeWaveDetail(wave: string): DecodedWave {
  const states: BitState[] = [];
  const stepGaps: boolean[] = [];
  let prev: BitState = '0';

  for (const char of wave) {
    switch (char) {
      case '|':
        if (states.length > 0) stepGaps[states.length - 1] = true;
        break;
      case '.':
        states.push(prev);
        break;
      case '0':
        states.push('0');
        prev = '0';
        break;
      case '1':
        states.push('1');
        prev = '1';
        break;
      case 'x':
      case 'X':
        states.push('x');
        prev = 'x';
        break;
      case 'z':
      case 'Z':
        states.push('z');
        prev = 'z';
        break;
      case 'u':
      case 'U':
        states.push('u');
        prev = 'u';
        break;
      case 'd':
      case 'D':
        states.push('d');
        prev = 'd';
        break;
      case 'p':
      case 'P':
        states.push('p');
        prev = 'p';
        break;
      case 'n':
      case 'N':
        states.push('n');
        prev = 'n';
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
        break;
      default:
        break;
    }
  }

  return { states, stepGaps };
}

export function decodeWaveString(wave: string): BitState[] {
  return decodeWaveDetail(wave).states;
}

export function encodeWaveString(
  states: BitState[],
  stepGaps?: boolean[],
): string {
  if (states.length === 0) return '';
  let wave = states[0]!;
  for (let i = 1; i < states.length; i++) {
    if (stepGaps?.[i - 1]) {
      wave += '|';
    } else if (states[i] === states[i - 1]) {
      wave += i === states.length - 1 ? states[i] : '.';
    } else {
      wave += states[i];
    }
  }
  return wave;
}
