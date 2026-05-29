declare module 'wavedrom' {
  export const version: string;
  export const waveSkin: unknown;
  export function renderWaveElement(
    index: number,
    source: unknown,
    outputElement: HTMLElement,
    waveSkin: unknown,
    notFirstSignal?: boolean,
  ): void;
}

declare module 'wavedrom/skins/dark.js' {
  const skin: { dark: unknown };
  export default skin;
}
