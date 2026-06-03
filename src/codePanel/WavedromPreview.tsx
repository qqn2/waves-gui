import { useEffect, useRef } from 'react';
import styles from './CodePanel.module.css';

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
        const parsed = JSON.parse(code) as unknown;
        const WaveDrom = await import('wavedrom');
        if (cancelled) return;
        el.replaceChildren();
        WaveDrom.renderWaveElement(0, parsed, el, WaveDrom.waveSkin, false);
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
