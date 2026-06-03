import type { WdRoot } from '../wavedromBridge/wdTypes';

/** Bundled “Clock and reset” starter (mirrors public/samples/clock-reset.json). */
export const CLOCK_RESET_SAMPLE: WdRoot = {
  signal: [
    { name: 'clk', wave: 'P........' },
    { name: 'reset_n', wave: '10........' },
    { name: 'enable', wave: '0..1..0..1' },
  ],
  config: { hscale: 1 },
  head: { text: 'Clock and reset' },
};
