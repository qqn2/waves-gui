/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import { PointerMarker } from './PointerMarker';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe('PointerMarker', () => {
  it('uses a snapped precision cursor without covering a row or cell', async () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.ticksPerStep = 4;
    const bit = diagram.signals.find((signal) => signal.type === 'bit');
    expect(bit?.type).toBe('bit');
    if (!bit || bit.type !== 'bit') return;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(
      <PointerMarker
        diagram={diagram}
        view={defaultView()}
        tool="cursor"
        hit={{
          signalId: bit.id,
          signalType: 'bit',
          step: 1,
          half: 'top',
          isLabelArea: false,
          isTimeAxis: false,
          edgeIndex: null,
          annotationId: null,
          canvasX: 90,
        }}
      />,
    ));

    expect(host.querySelector('.pointerPrecisionLine')).not.toBeNull();
    expect(host.querySelector('.pointerPrecisionTarget')).not.toBeNull();
    expect(host.querySelector('.pointerTickBadge')?.textContent).toBe('2+1/4');
    expect(host.querySelector('.pointerMarkerRow')).toBeNull();
    expect(host.querySelector('.pointerMarkerCol')).toBeNull();
    expect(host.querySelector('.pointerMarkerLabel')).toBeNull();

    await act(async () => root.unmount());
    host.remove();
  });
});
