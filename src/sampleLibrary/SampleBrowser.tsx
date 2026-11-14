import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, BookOpen, ChevronRight, Search, X } from 'lucide-react';
import { loadSampleDiagram } from '../shell/samples';
import {
  filterSampleLibrary,
  SAMPLE_LIBRARY_CATALOG,
  SAMPLE_LIBRARY_CATEGORIES,
  type SampleLibraryCategory,
} from './catalog';
import { SamplePreview } from './SamplePreview';
import { protocolLessons, SAMPLE_LEARNING_NOTES } from './learningNotes';
import styles from './SampleBrowser.module.css';

type CategoryId = SampleLibraryCategory['id'];
type Protocol = 'all' | 'apb' | 'ahb' | 'axi';
export function SampleBrowser({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<CategoryId>('amba');
  const [protocol, setProtocol] = useState<Protocol>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('amba/apb/write');
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const openRequest = useRef<AbortController | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const visibleEntries = useMemo(() => filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, category, query)
    .filter((entry) => category !== 'amba' || protocol === 'all' || entry.id.startsWith(`amba/${protocol}/`)),
  [category, protocol, query]);
  const selected = visibleEntries.find((entry) => entry.id === selectedId) ?? visibleEntries[0] ?? null;
  const categoryLabel = SAMPLE_LIBRARY_CATEGORIES.find((item) => item.id === category)?.label ?? 'All samples';
  const lesson = selected ? SAMPLE_LEARNING_NOTES[selected.id] : undefined;
  const path = lesson ? protocolLessons(lesson.protocol) : [];
  const nextLessonId = path[lesson?.order ?? 0]?.[0];
  const nextLesson = SAMPLE_LIBRARY_CATALOG.find(({ id }) => id === nextLessonId);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    searchRef.current?.focus();
    return () => {
      openRequest.current?.abort();
      dialog.close();
      const restore = opener?.isConnected && opener !== document.body ? opener
        : document.querySelector<HTMLElement>('[data-sample-browser-trigger]');
      restore?.focus();
    };
  }, []);

  const selectEntry = (id: string) => {
    openRequest.current?.abort();
    openRequest.current = null;
    setOpening(false);
    setOpenError(null);
    setSelectedId(id);
  };

  const changeScope = (next: CategoryId, nextProtocol: Protocol = 'all') => {
    selectEntry('');
    setCategory(next);
    setProtocol(nextProtocol);
  };

  const openCopy = async () => {
    if (!selected || openRequest.current) return;
    const controller = new AbortController();
    openRequest.current = controller;
    setOpening(true);
    setOpenError(null);
    try {
      const opened = await loadSampleDiagram(selected.id, controller.signal);
      if (opened && !controller.signal.aborted) closeRef.current();
    } catch (error: unknown) {
      if (!controller.signal.aborted) setOpenError(error instanceof Error ? error.message : 'Could not open this sample.');
    } finally {
      if (openRequest.current === controller && !controller.signal.aborted) {
        openRequest.current = null;
        setOpening(false);
      }
    }
  };

  const focusResult = (index: number) => {
    const button = resultsRef.current?.querySelectorAll<HTMLButtonElement>('[data-sample-id]')[index];
    button?.focus();
    button?.scrollIntoView({ block: 'nearest' });
  };

  const navigateResults = (event: KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowDown' ? Math.min(visibleEntries.length - 1, index + 1)
      : event.key === 'ArrowUp' ? Math.max(0, index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? visibleEntries.length - 1 : null;
    if (next !== null) {
      event.preventDefault();
      focusResult(next);
    }
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-modal="true" aria-labelledby="sample-library-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex]',
          )).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable.at(-1);
          // Native dialogs make the editor inert, but Chromium can move from
          // the final control into browser chrome. Keep keyboard browsing here.
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
        }
        if (event.key === 'Escape' && event.target === searchRef.current && query) {
          event.preventDefault();
          selectEntry('');
          setQuery('');
        }
      }}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.mark}><BookOpen size={22} aria-hidden /></span>
          <div><h2 id="sample-library-title">Sample library</h2><p>Explore a waveform. Understand the timing. Make it your own.</p></div>
        </div>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close sample library"><X size={20} /></button>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <span className={styles.eyebrow}>Explore</span>
          <nav className={styles.categories} aria-label="Sample categories">
            {SAMPLE_LIBRARY_CATEGORIES.map((item) => (
              <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => changeScope(item.id)}>
                <span>{item.label}</span><span className={styles.count}>{filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, item.id, '').length}</span>
              </button>
            ))}
          </nav>
          <div className={styles.sidebarNote}><BookOpen size={18} aria-hidden /><p>Start with APB, then explore AHB pipelining and AXI’s independent channels.</p></div>
        </aside>
        <section className={styles.browser} aria-label="Browse samples">
          <div className={styles.browserHeader}>
            <span className={styles.eyebrow}>{categoryLabel}</span>
            <label className={styles.search}>
              <Search size={16} aria-hidden />
              <input ref={searchRef} type="search" aria-label="Search samples" placeholder="Find a signal or concept…" value={query}
                onChange={(event) => { selectEntry(''); setQuery(event.target.value); }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && visibleEntries.length) {
                    event.preventDefault();
                    focusResult(Math.max(0, visibleEntries.findIndex((entry) => entry.id === selected?.id)));
                  }
                }} />
            </label>
            {category === 'amba' && <div className={styles.protocols} aria-label="AMBA protocol">
              {(['all', 'apb', 'ahb', 'axi'] as const).map((item) => (
                <button type="button" key={item} aria-pressed={protocol === item} onClick={() => changeScope('amba', item)}>
                  {item === 'all' ? 'All' : item.toUpperCase()}
                </button>
              ))}
            </div>}
            <span className={styles.resultCount} role="status">{visibleEntries.length} {visibleEntries.length === 1 ? 'sample' : 'samples'}{query ? ` matching “${query}”` : ''}</span>
          </div>
          <div ref={resultsRef} className={styles.results} role="listbox" aria-label="Samples">
            {visibleEntries.map((entry, index) => (
              <button key={entry.id} type="button" role="option" aria-selected={selected?.id === entry.id}
                data-sample-id={entry.id} tabIndex={selected?.id === entry.id ? 0 : -1}
                className={styles.sample} onFocus={() => selectEntry(entry.id)} onClick={() => selectEntry(entry.id)}
                onKeyDown={(event) => navigateResults(event, index)}>
                <span className={styles.sampleMeta}>{SAMPLE_LEARNING_NOTES[entry.id]
                  ? `${SAMPLE_LEARNING_NOTES[entry.id].protocol} · Lesson ${SAMPLE_LEARNING_NOTES[entry.id].order}`
                  : entry.source}</span>
                <span className={styles.sampleTitle}>{entry.title}<ChevronRight size={15} aria-hidden /></span>
                <span className={styles.sampleDescription}>{entry.description}</span>
              </button>
            ))}
          </div>
          {!visibleEntries.length && <div className={styles.empty}>
            <strong>No matching samples</strong><p>Try a protocol name such as AXI, or a signal such as PREADY.</p>
            <button type="button" onClick={() => { changeScope('all'); setQuery(''); }}>Show all samples</button>
          </div>}
        </section>
        <section className={styles.detail} aria-label="Selected sample">
          {selected ? <>
            <div className={styles.detailContent}>
            <div className={styles.detailHeading}>
              <span className={styles.eyebrow}>{lesson
                ? `${lesson.protocol} learning path · Lesson ${lesson.order} of ${path.length}`
                : `${selected.categoryLabel} / ${selected.source}`}</span>
              <h3>{selected.title}</h3>
              <p>{lesson?.summary ?? selected.description}</p>
            </div>
            {lesson && <p className={styles.objective}><strong>Learning goal</strong> {lesson.objective}</p>}
            <SamplePreview key={selected.id} entry={selected} lesson={lesson} />
            {lesson && <section key={`${selected.id}-notes`} className={styles.lesson} aria-label="Lesson notes">
              <div className={styles.takeaway}><h4>Key idea</h4><p>{lesson.takeaway}</p></div>
              <details className={styles.signalGuide}><summary>Signal guide</summary>
                <dl>{lesson.signals.map((signal) => <div key={signal.name}><dt>{signal.name}</dt><dd>{signal.meaning}</dd></div>)}</dl>
              </details>
              <div className={styles.exercise}><h4>Try it yourself</h4><p>{lesson.exercise.question}</p>
                <details><summary>Reveal explanation</summary><p>{lesson.exercise.answer}</p></details>
              </div>
              <a href={lesson.reference.url} target="_blank" rel="noreferrer">{lesson.reference.label}<ArrowUpRight size={14} aria-hidden /></a>
              <p className={styles.modelNote}>Simplified teaching trace. Signals outside the lesson are omitted; x marks data that is not relevant to the illustrated transfer.</p>
              {nextLesson && <button type="button" className={styles.nextLesson} onClick={() => {
                setQuery('');
                selectEntry(nextLesson.id);
                dialogRef.current?.querySelector(`.${styles.detailContent}`)?.scrollTo({ top: 0 });
              }}><span>Next lesson<strong>{nextLesson.title}</strong></span><ChevronRight size={18} aria-hidden /></button>}
            </section>}
            </div>
            <footer className={styles.detailFooter}>
              <div><strong>Try it in the editor</strong><span>Open a copy to change signals and explore the timing.</span></div>
              <button type="button" className={styles.primaryButton} disabled={opening} onClick={() => { void openCopy(); }}>
                {opening ? 'Opening…' : 'Open copy'}<ChevronRight size={16} aria-hidden />
              </button>
              {openError && <p className={styles.openError} role="alert">{openError} Try opening the copy again.</p>}
            </footer>
          </> : <div className={styles.empty}>Choose a sample to explore its waveform.</div>}
        </section>
      </div>
      <footer className={styles.footer}><span>Waveforms are previewed locally</span><span>↑ ↓ to browse <span aria-hidden>·</span> Esc to close</span></footer>
    </dialog>
  );
}
