import { useEffect, useRef } from 'react';
import { sanitizeDetachedSvg } from '../security/sanitizeSvg';
import styles from './CodePanel.module.css';

const SKIN_LOADERS: Record<string, () => Promise<unknown>> = {
  default: () => import('wavedrom/skins/default.js'),
  narrow: () => import('wavedrom/skins/narrow.js'),
  dark: () => import('wavedrom/skins/dark.js'),
  lowkey: () => import('wavedrom/skins/lowkey.js'),
};

export interface WavedromPreviewProps {
  code: string;
  error: string | null;
}

export function WavedromPreview({ code, error }: WavedromPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
        const parsed = JSON.parse(code) as { config?: { skin?: string } };
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
      } catch {
        if (!cancelled) el.replaceChildren();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, error]);

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewLabel}>WaveDrom render (local)</div>
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
