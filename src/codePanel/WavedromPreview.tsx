import { useEffect, useRef } from 'react';
import { useStore } from '../shared/store';
import { validateCodeString } from './codeSync';
import styles from './CodePanel.module.css';

export interface WavedromPreviewProps {
  code: string;
}

export function WavedromPreview({ code }: WavedromPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useStore((s) => s.view.theme);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (validateCodeString(code) !== null) {
      el.replaceChildren();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const parsed = JSON.parse(code) as unknown;
        const WaveDrom = await import('wavedrom');
        let skin = WaveDrom.waveSkin;
        if (theme === 'dark') {
          try {
            const darkModule = await import('wavedrom/skins/dark.js');
            skin = darkModule.default?.dark ?? skin;
          } catch {
            // fall back to default skin
          }
        }
        if (cancelled) return;
        WaveDrom.renderWaveElement(0, parsed, el, skin, false);
      } catch {
        if (!cancelled) el.replaceChildren();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewLabel}>WaveDrom preview</div>
      <div ref={containerRef} className={styles.preview} />
    </div>
  );
}
