import { useEffect, useRef, useState } from 'react';
import styles from './SignalPanel.module.css';

export interface InlineEditorProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function InlineEditor({ value, onCommit, onCancel }: InlineEditorProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const trimmed = draft.trim();
    onCommit(trimmed.length > 0 ? trimmed : value);
  };

  return (
    <input
      ref={inputRef}
      className={styles.inlineEditor}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
