import { useEffect, useId, useRef, useState } from 'react';
import { scanExtensionContent } from '../shared/annotations';
import { useStore } from '../shared/store';
import dialogStyles from './ExtensionsModeDialog.module.css';
import styles from './shell.module.css';

export function ExtensionsModeToggle() {
  const titleId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const diagram = useStore((state) => state.diagram);
  const enabled = useStore(
    (state) => state.diagram.compatibility?.extensionsEnabled === true,
  );
  const setExtensionsEnabled = useStore((state) => state.setExtensionsEnabled);
  const removeUndulateFeatures = useStore(
    (state) => state.removeUndulateFeatures,
  );
  const summary = scanExtensionContent(diagram);

  useEffect(() => {
    if (!confirmOpen) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen]);

  const requestModeChange = (nextEnabled: boolean) => {
    if (nextEnabled) {
      setExtensionsEnabled(true);
    } else if (summary.hasExtensions) {
      setConfirmOpen(true);
    } else {
      setExtensionsEnabled(false);
    }
  };

  return (
    <>
      <label
        className={`${styles.extensionsMode} ${enabled ? styles.extensionsModeActive : ''}`}
        title="Enable additive Undulate-compatible document features"
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => requestModeChange(event.target.checked)}
          aria-label="Undulate extensions"
        />
        <span>Undulate</span>
      </label>

      {confirmOpen ? (
        <div
          className={dialogStyles.backdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmOpen(false);
          }}
        >
          <section
            className={dialogStyles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId}>Turn off Undulate?</h2>
            <p>
              This document contains {summary.totalCount} Undulate feature
              {summary.totalCount === 1 ? '' : 's'}: {summary.annotationCount}{' '}
              annotation{summary.annotationCount === 1 ? '' : 's'} and{' '}
              {summary.analogueSignalCount} analogue signal
              {summary.analogueSignalCount === 1 ? '' : 's'}, and{' '}
              {summary.extendedDigitalSignalCount} digital signal
              {summary.extendedDigitalSignalCount === 1 ? '' : 's'} with
              Undulate wave characters, and {summary.expandedNodeCount} expanded
              node identifier{summary.expandedNodeCount === 1 ? '' : 's'}.
              {' '}{summary.extendedEdgeCount} dependency edge
              {summary.extendedEdgeCount === 1 ? '' : 's'} use Undulate endpoint
              markers.
            </p>
            <p>
              You can hide the features while preserving the Undulate JSON, or
              remove them from the document and return to WaveDrom JSON.
            </p>
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.primary}
                onClick={() => {
                  setExtensionsEnabled(false);
                  setConfirmOpen(false);
                }}
              >
                Hide features and preserve JSON
              </button>
              <button
                ref={cancelRef}
                type="button"
                className={dialogStyles.secondary}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={dialogStyles.danger}
                onClick={() => {
                  removeUndulateFeatures();
                  setConfirmOpen(false);
                }}
              >
                Remove Undulate features
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
