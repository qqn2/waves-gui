import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronRight,
  Cpu,
  Diamond,
  FileText,
  LayoutList,
  PanelBottom,
  PanelRight,
  Search,
  Star,
  X,
} from 'lucide-react';
import { renderDiagramImage } from '../exportEngine/exportImage';
import { defaultView } from '../shared/store/helpers';
import { useStore } from '../shared/store';
import { getSafeStorage } from '../shell/soloDesk/safeStorage';
import type { Theme } from '../shared/theme';
import {
  filterSampleLibrary,
  SAMPLE_LIBRARY_CATALOG,
  SAMPLE_LIBRARY_CATEGORIES,
  type SampleLibraryCategory,
  type SampleLibraryEntry,
} from './catalog';
import { loadSamplePreview } from './previewLoader';
import styles from './SampleBrowser.module.css';

export interface SampleBrowserProps {
  open: boolean;
  onClose: () => void;
  onPick: (sampleId: string) => void;
}

type PreviewDock = 'bottom' | 'right';

const PREVIEW_DOCK_STORAGE_KEY = 'waves-gui-sample-library-preview-dock';

const THUMBNAIL_PATHS = [
  'M2 34H14V14H28V34H42V20H56V34H70V10H84V34H98V23H112V34H126V16H140V34H158',
  'M2 30H18V18H34V30H50V12H66V30H82V24H98V30H114V8H130V30H146V20H158',
  'M2 34H18V26H34V18H50V26H66V10H82V26H98V18H114V26H130V14H146V34H158',
  'M2 28H22V12H42V28H62V12H82V28H102V12H122V28H142V12H158',
];

function loadPreviewDock(): PreviewDock {
  const stored = getSafeStorage().getItem(PREVIEW_DOCK_STORAGE_KEY);
  return stored === 'right' ? 'right' : 'bottom';
}

function thumbnailIndex(id: string): number {
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0)
    % THUMBNAIL_PATHS.length;
}

function FallbackWaveformThumbnail({
  entry,
  large = false,
}: {
  entry: SampleLibraryEntry;
  large?: boolean;
}) {
  const path = THUMBNAIL_PATHS[thumbnailIndex(entry.id)];
  return (
    <div className={`${styles.thumbnail} ${large ? styles.thumbnailLarge : ''}`}>
      <svg viewBox="0 0 160 42" aria-hidden>
        <path className={styles.thumbnailGrid} d="M2 6H158M2 20H158M2 34H158" />
        <path className={styles.thumbnailWave} d={path} />
      </svg>
    </div>
  );
}

function SampleThumbnail({
  entry,
  theme,
  large = false,
}: {
  entry: SampleLibraryEntry;
  theme: Theme;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const thumbnailUrl = theme === 'dark' ? entry.thumbnailUrl : entry.thumbnailLightUrl;

  useEffect(() => setFailed(false), [thumbnailUrl]);

  if (failed) return <FallbackWaveformThumbnail entry={entry} large={large} />;

  return (
    <div className={`${styles.thumbnail} ${large ? styles.thumbnailLarge : ''}`}>
      <img
        className={styles.thumbnailImage}
        src={thumbnailUrl}
        alt=""
        aria-hidden
        loading={large ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

type LoadedPreview = {
  sampleId: string;
  status: 'loading' | 'ready' | 'error';
  diagram: Awaited<ReturnType<typeof loadSamplePreview>> | null;
  error: string | null;
};

function TemplateWaveform({
  entry,
  theme,
}: {
  entry: SampleLibraryEntry;
  theme: Theme;
}) {
  const [loaded, setLoaded] = useState<LoadedPreview>({
    sampleId: entry.id,
    status: 'loading',
    diagram: null,
    error: null,
  });
  const [rendered, setRendered] = useState<{ sampleId: string; src: string } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const previewView = useMemo(() => ({
    ...defaultView(),
    labelWidth: 104,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    showAnchorLetters: false,
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded({ sampleId: entry.id, status: 'loading', diagram: null, error: null });
    void loadSamplePreview(entry, controller.signal)
      .then((diagram) => {
        if (controller.signal.aborted) return;
        setLoaded({ sampleId: entry.id, status: 'ready', diagram, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          sampleId: entry.id,
          status: 'error',
          diagram: null,
          error: error instanceof Error ? error.message : 'Could not load preview',
        });
      });
    return () => controller.abort();
  }, [entry]);

  const diagram = loaded.sampleId === entry.id ? loaded.diagram : null;
  const previewDiagram = useMemo(() => {
    if (!diagram) return null;
    if (!diagram.config.head?.text) return diagram;

    return {
      ...diagram,
      config: {
        ...diagram.config,
        head: {
          ...diagram.config.head,
          text: undefined,
        },
      },
    };
  }, [diagram]);

  useEffect(() => {
    if (!previewDiagram) return;
    let active = true;
    let objectUrl: string | null = null;
    setRendered(null);
    setRenderError(null);
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-canvas')
      .trim() || '#ffffff';
    void renderDiagramImage(previewDiagram, previewView, {
      format: 'png',
      scale: 1,
      background,
    })
      .then(({ blob }) => {
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setRendered({ sampleId: entry.id, src: objectUrl });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRenderError(error instanceof Error ? error.message : 'Could not render preview');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.id, previewDiagram, previewView, theme]);

  const image = rendered?.sampleId === entry.id ? rendered.src : null;
  const error = loaded.sampleId === entry.id && loaded.status === 'error'
    ? loaded.error
    : renderError;

  return (
    <div className={styles.waveformViewport} aria-label={`${entry.title} waveform preview`}>
      {image ? (
        <img className={styles.waveformImage} src={image} alt={`${entry.title} waveform preview`} />
      ) : (
        <div className={styles.waveformLoading}>
          <SampleThumbnail entry={entry} theme={theme} large />
          <span role={error ? 'alert' : 'status'}>
            {error ? 'Preview unavailable' : 'Rendering preview…'}
          </span>
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ category }: { category: SampleLibraryCategory['id'] }) {
  if (category === 'featured') return <Star size={16} aria-hidden />;
  if (category === 'all') return <LayoutList size={16} aria-hidden />;
  if (category === 'general') return <FileText size={16} aria-hidden />;
  if (category === 'amba') return <Cpu size={16} aria-hidden />;
  return <Diamond size={16} aria-hidden />;
}

function TemplatePreview({
  entry,
  theme,
  onPick,
}: {
  entry: SampleLibraryEntry | null;
  theme: Theme;
  onPick: (sampleId: string) => void;
}) {
  return (
    <section className={styles.preview} aria-label="Selected template preview">
      {entry ? (
        <>
          <header className={styles.previewHeader}>
            <div className={styles.previewHeading}>
              <h3>{entry.title}</h3>
              <div className={styles.previewMeta}>
                <span><strong>Source</strong>{entry.source}</span>
                <span className={styles.metaDivider} aria-hidden>│</span>
                <span className={styles.previewDescription}><strong>Description</strong>{entry.description}</span>
              </div>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => onPick(entry.id)}
            >
              Edit copy… <ChevronRight size={15} aria-hidden />
            </button>
          </header>
          <TemplateWaveform entry={entry} theme={theme} />
        </>
      ) : (
        <div className={styles.emptyPreview}>Choose a template to inspect its waveform.</div>
      )}
    </section>
  );
}

export function SampleBrowser({ open, onClose, onPick }: SampleBrowserProps) {
  const theme = useStore((state) => state.view.theme);
  const [category, setCategory] = useState<SampleLibraryCategory['id']>('undulate');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    SAMPLE_LIBRARY_CATALOG.find((entry) => entry.id === 'undulate/fine-timing')?.id
      ?? SAMPLE_LIBRARY_CATALOG[0]?.id
      ?? null,
  );
  const [dock, setDock] = useState<PreviewDock>(loadPreviewDock);
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const queryRef = useRef(query);
  const visibleEntriesRef = useRef<SampleLibraryEntry[]>([]);
  const selectedEntryRef = useRef<SampleLibraryEntry | null>(null);
  queryRef.current = query;

  const visibleEntries = useMemo(
    () => filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, category, query),
    [category, query],
  );
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedId)
    ?? visibleEntries[0]
    ?? null;
  visibleEntriesRef.current = visibleEntries;
  selectedEntryRef.current = selectedEntry;

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId(null);
      return;
    }
    if (selectedEntry.id !== selectedId) setSelectedId(selectedEntry.id);
  }, [selectedEntry, selectedId]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    searchRef.current?.focus();

    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
        || target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (target === searchRef.current && queryRef.current) {
          setQuery('');
        } else {
          onClose();
        }
        return;
      }
      if (!isTextEntry && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const entries = visibleEntriesRef.current;
        if (entries.length === 0) return;
        const currentIndex = Math.max(
          0,
          entries.findIndex((entry) => entry.id === selectedEntryRef.current?.id),
        );
        const nextIndex = event.key === 'ArrowDown'
          ? Math.min(entries.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
        setSelectedId(entries[nextIndex]?.id ?? null);
        return;
      }
      if (event.key === 'Enter' && document.activeElement === dialog) {
        event.preventDefault();
        const entry = selectedEntryRef.current;
        if (entry) onPick(entry.id);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? items.length - 1 : currentIndex - 1)
        : (currentIndex === items.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      items[nextIndex]?.focus();
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [open, onClose, onPick]);

  useEffect(() => {
    getSafeStorage().setItem(PREVIEW_DOCK_STORAGE_KEY, dock);
  }, [dock]);

  if (!open) return null;

  const selectEntry = (entry: SampleLibraryEntry) => setSelectedId(entry.id);
  const categoryLabel = SAMPLE_LIBRARY_CATEGORIES.find((item) => item.id === category)?.label;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-browser-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.appTitle}>
            <span className={styles.appMark} aria-hidden><Activity size={19} /></span>
            <h2 id="sample-browser-title">WAVES GUI <span>—</span> Sample Library</h2>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <span className={styles.visuallyHidden}>Search templates</span>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates…"
                type="search"
                aria-label="Search templates"
              />
              <kbd>Ctrl+F</kbd>
            </label>
            <div className={styles.dockToggle} aria-label="Preview docking">
              <button
                type="button"
                className={dock === 'bottom' ? styles.dockButtonActive : styles.dockButton}
                onClick={() => setDock('bottom')}
                aria-label="Dock preview to the bottom"
                aria-pressed={dock === 'bottom'}
                title="Dock preview to the bottom"
              >
                <PanelBottom size={17} aria-hidden />
              </button>
              <button
                type="button"
                className={dock === 'right' ? styles.dockButtonActive : styles.dockButton}
                onClick={() => setDock('right')}
                aria-label="Dock preview to the right"
                aria-pressed={dock === 'right'}
                title="Dock preview to the right"
              >
                <PanelRight size={17} aria-hidden />
              </button>
            </div>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close sample library" title="Close">
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className={`${styles.body} ${dock === 'right' ? styles.bodyRight : styles.bodyBottom}`}>
          <aside className={styles.sidebar} aria-label="Library navigation">
            <div className={styles.sidebarLabel}>Library</div>
            <nav aria-label="Sample categories">
              {SAMPLE_LIBRARY_CATEGORIES.map((item) => {
                const count = filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, item.id, '').length;
                const active = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.categoryButton} ${active ? styles.categoryButtonActive : ''}`}
                    aria-pressed={active}
                    title={item.description}
                    onClick={() => {
                      setCategory(item.id);
                      setQuery('');
                    }}
                  >
                    <CategoryIcon category={item.id} />
                    <span>{item.label}</span>
                    <span className={styles.categoryCount}>{count}</span>
                    {item.id === 'amba' ? <ChevronRight className={styles.categoryChevron} size={14} aria-hidden /> : null}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className={styles.results} aria-label="Template browser">
            <div className={styles.resultsHeader}>
              <div>
                <div className={styles.resultsKicker}>{categoryLabel}</div>
                <h3>Templates ({visibleEntries.length})</h3>
              </div>
              <span className={styles.resultsHint}>Select a row to inspect its waveform</span>
            </div>

            {visibleEntries.length > 0 ? (
              <div className={styles.templateTable}>
                <div className={styles.tableHeader} aria-hidden>
                  <span>Preview</span>
                  <span>Name <span className={styles.sortArrow}>▲</span></span>
                  <span>Source</span>
                  <span>Description</span>
                </div>
                <div className={styles.templateRows}>
                  {visibleEntries.map((entry) => {
                    const active = selectedEntry?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`${styles.templateRow} ${active ? styles.templateRowActive : ''}`}
                        aria-pressed={active}
                        onClick={() => selectEntry(entry)}
                        onDoubleClick={() => onPick(entry.id)}
                        title={`${entry.title} — ${entry.description}`}
                      >
                        <span className={styles.previewCell}><SampleThumbnail entry={entry} theme={theme} /></span>
                        <span className={styles.nameCell}>{entry.title}</span>
                        <span className={styles.sourceCell}>{entry.source}</span>
                        <span className={styles.descriptionCell}>{entry.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>No templates match “{query}”.</strong>
                <button type="button" className={styles.secondaryButton} onClick={() => setQuery('')}>
                  Clear search
                </button>
              </div>
            )}
          </section>

          <TemplatePreview entry={selectedEntry} theme={theme} onPick={onPick} />
        </div>

        <footer className={styles.footer}>
          <span>{SAMPLE_LIBRARY_CATALOG.length} templates</span>
          <span className={styles.footerHint}>Double-click a template to open</span>
        </footer>
      </div>
    </div>
  );
}
