import { describe, expect, it } from 'vitest';
import {
  formatAnnotationRangePosition,
  MAX_ANNOTATION_TEXT_LENGTH,
  normalizeAnnotations,
  parseAnnotationRangeInput,
  scanExtensionContent,
} from './annotations';

describe('annotations', () => {
  it('normalizes text annotations within document limits', () => {
    const [annotation] = normalizeAnnotations(
      [
        {
          id: 'note-1',
          type: 'text',
          text: 'x'.repeat(MAX_ANNOTATION_TEXT_LENGTH + 10),
          tick: 99,
          signalId: 'sig-1',
          yOffset: Number.POSITIVE_INFINITY,
        },
      ],
      8,
    );

    expect(annotation).toMatchObject({
      id: 'note-1',
      type: 'text',
      tick: 7,
      signalId: 'sig-1',
    });
    expect(annotation?.type).toBe('text');
    if (annotation?.type !== 'text') return;
    expect(annotation.text).toHaveLength(MAX_ANNOTATION_TEXT_LENGTH);
    expect(annotation).not.toHaveProperty('yOffset');
  });

  it('drops malformed and unsupported annotation objects', () => {
    expect(
      normalizeAnnotations(
        [null, 'text', { type: 'line' }, { type: 'text', text: 'ok', tick: 1 }],
        4,
      ),
    ).toHaveLength(1);
  });

  it('normalizes global compression and bounded safe styles', () => {
    expect(normalizeAnnotations([
      {
        id: 'compression',
        type: 'global-compression',
        tick: 3,
        style: {
          fill: '#abc',
          stroke: 'rgb(1, 2, 3)',
          strokeWidth: 2,
          strokeDasharray: [4, 2],
          fontSize: 18,
          textBackground: false,
        },
      },
      {
        id: 'unsafe',
        type: 'vertical-line',
        tick: 1,
        style: { stroke: 'url(https://example.test)', strokeWidth: 100 },
      },
    ], 8)).toEqual([
      expect.objectContaining({
        id: 'compression',
        type: 'global-compression',
        style: {
          fill: '#abc',
          stroke: 'rgb(1, 2, 3)',
          strokeWidth: 2,
          strokeDasharray: [4, 2],
          fontSize: 18,
          textBackground: false,
        },
      }),
      expect.not.objectContaining({ style: expect.anything() }),
    ]);
  });

  it('normalizes and formats numeric and percentage line ranges', () => {
    const annotations = normalizeAnnotations([
      {
        id: 'v',
        type: 'vertical-line',
        tick: 1,
        rangeFrom: { unit: 'index', value: 0.5 },
        rangeTo: { unit: 'percent', value: 75 },
      },
    ], 8);
    expect(annotations[0]).toMatchObject({
      rangeFrom: { unit: 'index', value: 0.5 },
      rangeTo: { unit: 'percent', value: 75 },
    });
    expect(parseAnnotationRangeInput(' 2.5 ')).toEqual({
      unit: 'index',
      value: 2.5,
    });
    expect(parseAnnotationRangeInput('25%')).toEqual({
      unit: 'percent',
      value: 25,
    });
    expect(parseAnnotationRangeInput('101%')).toBeNull();
    expect(formatAnnotationRangePosition({
      unit: 'percent',
      value: 25,
    })).toBe('25%');
  });

  it('reports extension content independently from mode state', () => {
    expect(scanExtensionContent({ annotations: [] })).toEqual({
      annotationCount: 0,
      analogueSignalCount: 0,
      extendedDigitalSignalCount: 0,
      expandedNodeCount: 0,
      extendedEdgeCount: 0,
      totalCount: 0,
      hasExtensions: false,
    });
    expect(
      scanExtensionContent({
        annotations: [
          { id: 'a', type: 'text', text: 'note', tick: 0 },
        ],
      }),
    ).toEqual({
      annotationCount: 1,
      analogueSignalCount: 0,
      extendedDigitalSignalCount: 0,
      expandedNodeCount: 0,
      extendedEdgeCount: 0,
      totalCount: 1,
      hasExtensions: true,
    });
    expect(
      scanExtensionContent({
        annotations: [],
        signals: [
          {
            id: 'extended',
            name: 'extended',
            type: 'bit',
            states: ['0', 'h', 'L', '1'],
            segments: [],
            color: '#4A9EFF',
            rowHeight: 40,
          },
        ],
      }),
    ).toEqual({
      annotationCount: 0,
      analogueSignalCount: 0,
      extendedDigitalSignalCount: 1,
      expandedNodeCount: 0,
      extendedEdgeCount: 0,
      totalCount: 1,
      hasExtensions: true,
    });
    expect(
      scanExtensionContent({
        annotations: [],
        signals: [{
          id: 'nodes',
          name: 'nodes',
          type: 'bit',
          states: ['0', '1'],
          segments: [],
          color: '#4A9EFF',
          rowHeight: 40,
          nodeNames: { 1: 'request.ready' },
        }],
      }),
    ).toMatchObject({
      expandedNodeCount: 1,
      totalCount: 1,
      hasExtensions: true,
    });
    expect(
      scanExtensionContent({
        annotations: [],
        edges: ['a-#b', 'a->b'],
      }),
    ).toMatchObject({
      extendedEdgeCount: 1,
      totalCount: 1,
      hasExtensions: true,
    });
  });
});
