import { useEffect, useRef, useState } from 'react';
import { buildSVGString } from '../exportEngine/exportSVG';
import { sanitizeDetachedSvg } from '../security/sanitizeSvg';
import { useStore } from '../shared/store';
import { toWavedromJSON } from '../wavedromBridge';
import { parseCodeToDiagram, type DiagramCodeFormat } from './codeSync';
import { parseJSON5Source } from './json5Source';
import styles from './CodePanel.module.css';

const SKIN_LOADERS: Record<string, () => Promise<unknown>> = {
  default: () => import('wavedrom/skins/default.js'),
  narrow: () => import('wavedrom/skins/narrow.js'),
  dark: () => import('wavedrom/skins/dark.js'),
  lowkey: () => import('wavedrom/skins/lowkey.js'),
};

export interface WavedromPreviewProps {
  code: string;
  format: DiagramCodeFormat;
  error: string | null;
}

export function WavedromPreview({
  code,
  format,
  error,
}: WavedromPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelWidth = useStore((state) => state.view.labelWidth);
  const theme = useStore((state) => state.view.theme);
  const accentColor = useStore((state) => state.view.accentColor);
  const canvasColor = useStore((state) => state.view.canvasColor);
  const extensionsEnabled = useStore(
    (state) => state.diagram.compatibility?.extensionsEnabled === true,
  );
  const [previewZoom, setPreviewZoom] = useState<'fit' | number>('fit');
  const previewZoomRef = useRef<'fit' | number>(previewZoom);
  previewZoomRef.current = previewZoom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (error) {
      el.replaceChildren();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        let parsed: { config?: { skin?: string } };
        if (format === 'undulate') {
          const result = parseCodeToDiagram(code, { preferUndulate: true });
          if (result.ok === false) throw new Error(result.error);
          if (extensionsEnabled) {
            const currentView = useStore.getState().view;
            const previewView = {
              ...currentView,
              labelWidth,
              zoom: 1,
              scrollX: 0,
              scrollY: 0,
              paintDraft: null,
              edgeAnchorPending: null,
              edgeToolHover: null,
              activeAnnotationId: null,
            };
            const svgText = buildSVGString(result.diagram, previewView);
            const svgDocument = new DOMParser().parseFromString(
              svgText,
              'image/svg+xml',
            );
            if (svgDocument.querySelector('parsererror')) {
              throw new Error('Could not build Undulate preview');
            }
            const staging = document.createElement('div');
            staging.append(document.importNode(svgDocument.documentElement, true));
            sanitizeDetachedSvg(staging);
            if (cancelled) return;
            el.replaceChildren(...Array.from(staging.childNodes));
            sizePreviewSvg(el, previewZoomRef.current);
            return;
          }
          parsed = toWavedromJSON(result.diagram);
        } else {
          parsed = parseJSON5Source(code) as {
            config?: { skin?: string };
          };
        }

        const skinName = parsed.config?.skin ?? 'default';
        const WaveDrom = await import('wavedrom');
        const skinMod = await (SKIN_LOADERS[skinName] ?? SKIN_LOADERS.default!)();
        const skin = (skinMod as { default?: unknown }).default ?? skinMod;
        if (cancelled) return;
        const staging = document.createElement('div');
        WaveDrom.renderWaveElement(0, parsed, staging, skin, false);
        sanitizeDetachedSvg(staging);
        if (cancelled) return;
        el.replaceChildren(...Array.from(staging.childNodes));
        sizePreviewSvg(el, previewZoomRef.current);
      } catch {
        if (!cancelled) el.replaceChildren();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accentColor,
    canvasColor,
    code,
    error,
    extensionsEnabled,
    format,
    labelWidth,
    theme,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) sizePreviewSvg(el, previewZoom);
  }, [previewZoom]);

  const changeZoom = (factor: number) => {
    setPreviewZoom((current) => {
      const base = current === 'fit' ? 1 : current;
      return Math.max(0.25, Math.min(4, base * factor));
    });
  };

  return (
    <div className={styles.previewWrap}>
      <span className={styles.previewLabel}>
        {format === 'undulate' && extensionsEnabled
          ? 'Undulate render (local)'
          : format === 'undulate'
            ? 'WaveDrom compatibility render (local)'
          : 'WaveDrom render (local)'}
      </span>
      <div className={styles.previewControls} aria-label="Local render scale controls">
        <button
          type="button"
          onClick={() => changeZoom(0.8)}
          aria-label="Zoom local render out"
        >
          −
        </button>
        <button
          type="button"
          className={previewZoom === 1 ? styles.previewControlActive : ''}
          onClick={() => setPreviewZoom(1)}
          aria-pressed={previewZoom === 1}
        >
          100%
        </button>
        <button
          type="button"
          className={previewZoom === 'fit' ? styles.previewControlActive : ''}
          onClick={() => setPreviewZoom('fit')}
          aria-pressed={previewZoom === 'fit'}
        >
          Fit
        </button>
        <button
          type="button"
          onClick={() => changeZoom(1.25)}
          aria-label="Zoom local render in"
        >
          +
        </button>
      </div>
      {error ? (
        <div className={styles.preview}>
          <p className={styles.previewError}>Fix JSON to preview: {error}</p>
        </div>
      ) : (
        <div ref={containerRef} className={styles.preview} />
      )}
    </div>
  );
}

function sizePreviewSvg(
  container: HTMLDivElement,
  zoom: 'fit' | number,
): void {
  const svg = container.querySelector('svg');
  if (!svg) return;
  svg.style.height = 'auto';
  if (zoom === 'fit') {
    svg.style.width = '';
    svg.style.maxWidth = '100%';
    return;
  }
  const viewBoxWidth = svg.viewBox.baseVal.width;
  const attributeWidth = Number.parseFloat(svg.getAttribute('width') ?? '');
  const naturalWidth = viewBoxWidth || attributeWidth;
  svg.style.maxWidth = 'none';
  if (Number.isFinite(naturalWidth) && naturalWidth > 0) {
    svg.style.width = `${naturalWidth * zoom}px`;
  }
}
