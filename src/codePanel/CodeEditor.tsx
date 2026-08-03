import { useEffect, useRef } from 'react';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { defaultKeymap } from '@codemirror/commands';
import { linter, lintGutter } from '@codemirror/lint';
import {
  validateCodeString,
  type DiagramCodeFormat,
} from './codeSync';
import { flushPendingCodeToDiagram } from './flushRegistry';
import { useStore } from '../shared/store';
import styles from './CodePanel.module.css';

export interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  /** Flush pending debounced JSON → diagram apply (e.g. on blur). */
  onBlur?: () => void;
  error: string | null;
  format: DiagramCodeFormat;
}

function codeLinter(format: DiagramCodeFormat) {
  return linter((view) => {
    const message = validateCodeString(view.state.doc.toString(), {
      preferUndulate: format !== 'wavedrom',
      preferYAML: format === 'undulate-yaml',
      preferTOML: format === 'undulate-toml',
    });
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

function codeLanguage(format: DiagramCodeFormat): Extension {
  if (format === 'undulate-yaml') return yaml();
  if (format === 'undulate-toml') return StreamLanguage.define(toml);
  return json();
}

function editorTheme(): Extension {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: 'calc(12px * var(--ui-font-scale, 1))',
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

const unifiedHistoryKeymap = [
  {
    key: 'Mod-z',
    run: () => {
      if (!flushPendingCodeToDiagram().ok) return false;
      useStore.getState().undo();
      return true;
    },
  },
  {
    key: 'Mod-y',
    run: () => {
      if (!flushPendingCodeToDiagram().ok) return false;
      useStore.getState().redo();
      return true;
    },
  },
  {
    key: 'Mod-Shift-z',
    run: () => {
      if (!flushPendingCodeToDiagram().ok) return false;
      useStore.getState().redo();
      return true;
    },
  },
];

export function CodeEditor({
  code,
  onChange,
  onBlur,
  error,
  format,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lintCompartmentRef = useRef(new Compartment());
  const languageCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const syncingRef = useRef(false);

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
          languageCompartmentRef.current.of(codeLanguage(format)),
          lintCompartmentRef.current.of(codeLinter(format)),
          lintGutter(),
          editorTheme(),
          keymap.of([...unifiedHistoryKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((update) => {
            if (syncingRef.current || !update.docChanged) return;
            onChangeRef.current(update.state.doc.toString());
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
    const current = view.state.doc.toString();
    if (current !== code) {
      syncingRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
        // Let CodeMirror map the selection through the replacement. Passing
        // the pre-change selection verbatim can leave a cursor past the end
        // when a canvas edit regenerates a shorter document, which makes the
        // editor fail to mount with "Selection points outside of document".
      });
      queueMicrotask(() => {
        syncingRef.current = false;
      });
    }
  }, [code]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        languageCompartmentRef.current.reconfigure(codeLanguage(format)),
        lintCompartmentRef.current.reconfigure(codeLinter(format)),
      ],
    });
  }, [format]);

  const statusClass = error ? styles.statusError : styles.statusOk;

  return (
    <div className={styles.editorWrap}>
      <div ref={containerRef} className={styles.editor} />
      <div
        className={`${styles.statusBar} ${statusClass}`}
        role={error ? 'alert' : 'status'}
        aria-live="polite"
      >
        {error ? error : '✓ Valid'}
      </div>
    </div>
  );
}
