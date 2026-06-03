import { useEffect, useRef } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { linter, lintGutter } from '@codemirror/lint';
import { validateCodeString } from './codeSync';
import styles from './CodePanel.module.css';

export interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  /** Flush pending debounced JSON → diagram apply (e.g. on blur). */
  onBlur?: () => void;
  error: string | null;
}

function jsonLinter() {
  return linter((view) => {
    const message = validateCodeString(view.state.doc.toString());
    if (!message) return [];
    return [
      {
        from: 0,
        to: view.state.doc.length,
        severity: 'error' as const,
        message,
      },
    ];
  });
}

function editorTheme(): Extension {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: '12px',
        backgroundColor: 'var(--bg-panel, #242424)',
        color: 'var(--text-primary, #e8e8e8)',
      },
      '.cm-scroller': {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        lineHeight: '1.45',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-panel, #242424)',
        color: 'var(--text-secondary, #999)',
        borderRight: '1px solid var(--border, #333)',
      },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--accent, #4a9eff) 8%, transparent)',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--text-primary, #e8e8e8)',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--accent, #4a9eff) 28%, transparent)',
      },
    },
    { dark: true },
  );
}

export function CodeEditor({ code, onChange, onBlur, error }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const skipExternalSyncRef = useRef(false);

  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          json(),
          jsonLinter(),
          lintGutter(),
          editorTheme(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              skipExternalSyncRef.current = true;
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            blur: () => onBlurRef.current?.(),
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      return;
    }
    const current = view.state.doc.toString();
    if (current !== code) {
      skipExternalSyncRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
        selection: view.state.selection,
      });
    }
  }, [code]);

  const statusClass = error ? styles.statusError : styles.statusOk;

  return (
    <div className={styles.editorWrap}>
      <div ref={containerRef} className={styles.editor} />
      <div className={`${styles.statusBar} ${statusClass}`}>
        {error ? error : '✓ Valid'}
      </div>
    </div>
  );
}
