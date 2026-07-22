import { describe, expect, it } from 'vitest';
import { vcdToWavedromJSON } from './vcd';

describe('vcdToWavedromJSON', () => {
  it('converts scalar and vector changes to WaveDrom JSON', () => {
    const wd = vcdToWavedromJSON(`
$date today $end
$scope module top $end
$var wire 1 ! clk $end
$var wire 4 " data [3:0] $end
$upscope $end
$enddefinitions $end
#0
0!
b0000 "
#5
1!
#10
0!
b1010 "
#15
1!
`);

    expect(wd.signal).toEqual([
      { name: 'clk', wave: '0101' },
      { name: 'data [3:0]', wave: '=.=.', data: ['0000', '1010'] },
    ]);
    expect(wd.config?.head).toEqual({ tick: 0 });
  });

  it('keeps unchanged values as dotted wave cells', () => {
    const wd = vcdToWavedromJSON(`
$var wire 1 a ready $end
$enddefinitions $end
#0
1a
#10
#20
0a
`);

    expect(wd.signal).toEqual([{ name: 'ready', wave: '10' }]);
  });
});
