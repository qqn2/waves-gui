import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronRight,
  Cpu,
  Diamond,
  FileText,
  PanelBottom,
  PanelRight,
  Search,
  X,
} from 'lucide-react';
import { renderDiagramImage } from '../exportEngine/exportImage';
import { defaultView } from '../shared/store/helpers';
import { useStore } from '../shared/store';
import { getSafeStorage } from '../shell/soloDesk/safeStorage';
import type { Theme } from '../shared/theme';
import {
  categoriesFromIndex,
  filterSampleLibrary,
  projectManifestEntry,
  type SampleLibraryCategory,
  type SampleLibraryEntry,
} from './catalog';
import { CatalogRepository } from './catalogRepository';
import type { CatalogIndexV1, CatalogShardId, CatalogShardV1 } from './catalogTypes';
import { loadSamplePreview } from './previewLoader';
import styles from './SampleBrowser.module.css';

export interface SampleBrowserProps {
  open: boolean;
  onClose: () => void;
  onPick: (entry: SampleLibraryEntry) => void;
  repository?: CatalogRepository;
}

type PreviewDock = 'bottom' | 'right';
type LoadState<T> =
  | { status: 'idle' | 'loading'; value: null; error: null }
  | { status: 'ready'; value: T; error: null }
  | { status: 'error'; value: null; error: string };

const DEFAULT_SHARD: CatalogShardId = 'fundamentals';
const PREVIEW_DOCK_STORAGE_KEY = 'waves-gui-sample-library-preview-dock';
const DEFAULT_REPOSITORY = new CatalogRepository();
const IDLE = { status: 'idle', value: null, error: null } as const;

const THUMBNAIL_PATHS = [
  'M2 34H14V14H28V34H42V20H56V34H70V10H84V34H98V23H112V34H126V16H140V34H158',
  'M2 30H18V18H34V30H50V12H66V30H82V24H98V30H114V8H130V30H146V20H158',
  'M2 34H18V26H34V18H50V26H66V10H82V26H98V18H114V26H130V14H146V34H158',
  'M2 28H22V12H42V28H62V12H82V28H102V12H122V28H142V12H158',
];

function loadPreviewDock(): PreviewDock {
  return getSafeStorage().getItem(PREVIEW_DOCK_STORAGE_KEY) === 'right' ? 'right' : 'bottom';
}

function thumbnailIndex(id: string): number {
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % THUMBNAIL_PATHS.length;
}

function FallbackWaveformThumbnail({ entry, large = false }: { entry: SampleLibraryEntry; large?: boolean }) {
  return (
    <div className={`${styles.thumbnail} ${large ? styles.thumbnailLarge : ''}`}>
      <svg viewBox="0 0 160 42" aria-hidden>
        <path className={styles.thumbnailGrid} d="M2 6H158M2 20H158M2 34H158" />
        <path className={styles.thumbnailWave} d={THUMBNAIL_PATHS[thumbnailIndex(entry.id)]} />
      </svg>
    </div>
  );
}

function SampleThumbnail({ entry, theme, large = false }: {
  entry: SampleLibraryEntry;
  theme: Theme;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const thumbnailUrl = theme === 'dark' ? entry.thumbnailUrl : entry.thumbnailLightUrl;
  useEffect(() => setFailed(false), [thumbnailUrl]);
  if (!thumbnailUrl || failed || entry.support === 'future') {
    return <FallbackWaveformThumbnail entry={entry} large={large} />;
  }
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

function TemplateWaveform({ entry, theme }: { entry: SampleLibraryEntry; theme: Theme }) {
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
    if (entry.support === 'future') {
      setLoaded({
        sampleId: entry.id,
        status: 'error',
        diagram: null,
        error: entry.supportNote ?? 'This fixture is retained for future parser support.',
      });
      return () => controller.abort();
    }
    void loadSamplePreview(entry, controller.signal).then((diagram) => {
      if (!controller.signal.aborted) setLoaded({ sampleId: entry.id, status: 'ready', diagram, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoaded({
          sampleId: entry.id,
          status: 'error',
          diagram: null,
          error: error instanceof Error ? error.message : 'Could not load preview',
        });
      }
    });
    return () => controller.abort();
  }, [entry]);

  const diagram = loaded.sampleId === entry.id ? loaded.diagram : null;
  const previewDiagram = useMemo(() => {
    if (!diagram || !diagram.config.head?.text) return diagram;
    return {
      ...diagram,
      config: { ...diagram.config, head: { ...diagram.config.head, text: undefined } },
    };
  }, [diagram]);

  useEffect(() => {
    if (!previewDiagram) return;
    let active = true;
    let objectUrl: string | null = null;
    setRendered(null);
    setRenderError(null);
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() || '#ffffff';
    void renderDiagramImage(previewDiagram, previewView, { format: 'png', scale: 1, background })
      .then(({ blob }) => {
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
        } else {
          setRendered({ sampleId: entry.id, src: objectUrl });
        }
      })
      .catch((error: unknown) => {
        if (active) setRenderError(error instanceof Error ? error.message : 'Could not render preview');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.id, previewDiagram, previewView, theme]);

  const image = rendered?.sampleId === entry.id ? rendered.src : null;
  const error = loaded.sampleId === entry.id && loaded.status === 'error' ? loaded.error : renderError;
  return (
    <div className={styles.waveformViewport} aria-label={`${entry.title} waveform preview`}>
      {image ? (
        <img className={styles.waveformImage} src={image} alt={`${entry.title} waveform preview`} />
      ) : (
        <div className={styles.waveformLoading}>
          <SampleThumbnail entry={entry} theme={theme} large />
          <span role={entry.support === 'future' || error ? 'alert' : 'status'}>
            {entry.support === 'future' ? 'Preview pending support' : error ? 'Preview unavailable' : 'Rendering preview…'}
          </span>
          {entry.supportNote ? <span className={styles.previewSupportNote}>{entry.supportNote}</span> : null}
        </div>
      )}
    </div>
  );
}

function CategoryIcon({ category }: { category: CatalogShardId }) {
  if (category === 'fundamentals' || category === 'clocking-reset') return <FileText size={16} aria-hidden />;
  if (category === 'amba' || category === 'axi-stream-other-buses') return <Cpu size={16} aria-hidden />;
  return <Diamond size={16} aria-hidden />;
}

function canEdit(entry: SampleLibraryEntry): boolean {
  return entry.contentStatus !== 'index-only' && entry.assetUrl !== undefined && entry.support !== 'future';
}

function ContentStatusBadge({ entry }: { entry: SampleLibraryEntry }) {
  if (entry.contentStatus === 'draft') {
    return <span className={styles.unvalidatedBadge}>Unvalidated</span>;
  }
  if (entry.contentStatus === 'index-only') {
    return <span className={styles.futureBadge}>Planned</span>;
  }
  if (entry.contentStatus === 'featured') {
    return <span className={styles.featuredBadge}>Featured</span>;
  }
  return null;
}

function TemplatePreview({ entry, theme, onPick }: {
  entry: SampleLibraryEntry | null;
  theme: Theme;
  onPick: (entry: SampleLibraryEntry) => void;
}) {
  if (!entry) return <section className={styles.preview}><div className={styles.emptyPreview}>Choose a template to inspect its waveform.</div></section>;
  const editable = canEdit(entry);
  return (
    <section className={styles.preview} aria-label="Selected template preview">
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
          onClick={() => editable && onPick(entry)}
          disabled={!editable}
          title={!editable
            ? 'This planned sample does not have an editable waveform yet'
            : entry.contentStatus === 'draft'
              ? 'This waveform is unvalidated; review it before relying on it'
              : undefined}
        >
          {editable ? <>{entry.contentStatus === 'draft' ? 'Edit unvalidated copy…' : 'Edit copy…'} <ChevronRight size={15} aria-hidden /></> : 'Planned sample'}
        </button>
      </header>
      {entry.contentStatus === 'draft' ? (
        <div className={styles.validationNotice} role="status">
          <strong>Unvalidated draft.</strong> Review this waveform before using it as a reference.
        </div>
      ) : null}
      {editable ? (
        <TemplateWaveform entry={entry} theme={theme} />
      ) : (
        <div className={styles.emptyPreview} role="status">
          This catalog entry is planned. No waveform preview is available yet.
        </div>
      )}
    </section>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not load the sample catalog';
}

export function SampleBrowser({
  open,
  onClose,
  onPick,
  repository = DEFAULT_REPOSITORY,
}: SampleBrowserProps) {
  const theme = useStore((state) => state.view.theme);
  const [category, setCategory] = useState<CatalogShardId>(DEFAULT_SHARD);
  const [query, setQuery] = useState('');
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [includePlanned, setIncludePlanned] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dock, setDock] = useState<PreviewDock>(loadPreviewDock);
  const [indexState, setIndexState] = useState<LoadState<CatalogIndexV1>>(IDLE);
  const [shardStates, setShardStates] = useState<Partial<Record<CatalogShardId, LoadState<CatalogShardV1>>>>({});
  const [indexAttempt, setIndexAttempt] = useState(0);
  const [shardAttempts, setShardAttempts] = useState<Partial<Record<CatalogShardId, number>>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const queryRef = useRef(query);
  const visibleEntriesRef = useRef<SampleLibraryEntry[]>([]);
  const selectedEntryRef = useRef<SampleLibraryEntry | null>(null);
  queryRef.current = query;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setShardStates({});
    setSelectedId(null);
    setIndexState({ status: 'loading', value: null, error: null });
    void repository.getIndex().then((index) => {
      if (active) setIndexState({ status: 'ready', value: index, error: null });
    }).catch((error: unknown) => {
      if (active) setIndexState({ status: 'error', value: null, error: errorMessage(error) });
    });
    return () => { active = false; };
  }, [indexAttempt, open, repository]);

  const shardState = shardStates[category] ?? IDLE;
  useEffect(() => {
    if (!open || indexState.status !== 'ready') return;
    let active = true;
    setShardStates((current) => ({
      ...current,
      [category]: { status: 'loading', value: null, error: null },
    }));
    void repository.getShard(category).then((shard) => {
      if (active) setShardStates((current) => ({
        ...current,
        [category]: { status: 'ready', value: shard, error: null },
      }));
    }).catch((error: unknown) => {
      if (active) setShardStates((current) => ({
        ...current,
        [category]: { status: 'error', value: null, error: errorMessage(error) },
      }));
    });
    return () => { active = false; };
  }, [category, indexState.status, open, repository, shardAttempts]);

  const categories = indexState.status === 'ready' ? categoriesFromIndex(indexState.value.shards) : [];
  const entries = useMemo(() => shardState.status === 'ready'
    ? shardState.value.entries.map((entry) => projectManifestEntry(entry, repository))
    : [], [repository, shardState]);
  const visibleEntries = useMemo(
    () => filterSampleLibrary(entries, query, includeDrafts, includePlanned),
    [entries, includeDrafts, includePlanned, query],
  );
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedId) ?? null;
  visibleEntriesRef.current = visibleEntries;
  selectedEntryRef.current = selectedEntry;

  useEffect(() => {
    if (selectedId && !visibleEntries.some((entry) => entry.id === selectedId)) setSelectedId(null);
  }, [selectedId, visibleEntries]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    searchRef.current?.focus();
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextEntry = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT' || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (target === searchRef.current && queryRef.current) setQuery('');
        else onClose();
        return;
      }
      if (!isTextEntry && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const items = visibleEntriesRef.current;
        if (!items.length) return;
        const current = items.findIndex((entry) => entry.id === selectedEntryRef.current?.id);
        const next = event.key === 'ArrowDown'
          ? Math.min(items.length - 1, current + 1)
          : Math.max(0, current < 0 ? 0 : current - 1);
        setSelectedId(items[next]?.id ?? null);
        return;
      }
      if (event.key === 'Enter' && document.activeElement === dialog) {
        event.preventDefault();
        const entry = selectedEntryRef.current;
        if (entry && canEdit(entry)) onPick(entry);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (current <= 0 ? items.length - 1 : current - 1)
        : (current === items.length - 1 ? 0 : current + 1);
      event.preventDefault();
      items[next]?.focus();
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [open, onClose, onPick]);

  useEffect(() => getSafeStorage().setItem(PREVIEW_DOCK_STORAGE_KEY, dock), [dock]);
  if (!open) return null;

  const categoryLabel = categories.find((item) => item.id === category)?.label ?? 'Templates';
  const retryIndex = () => setIndexAttempt((attempt) => attempt + 1);
  const retryShard = () => setShardAttempts((current) => ({
    ...current,
    [category]: (current[category] ?? 0) + 1,
  }));

  return (
    <div className={styles.backdrop} role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
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
            <h2 id="sample-browser-title">Waves GUI <span>—</span> Template Library</h2>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <span className={styles.visuallyHidden}>Search templates in selected category</span>
              <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this category…" type="search" aria-label="Search templates in selected category" />
              <kbd>Ctrl+F</kbd>
            </label>
            <div className={styles.dockToggle} aria-label="Preview docking">
              <button type="button" className={dock === 'bottom' ? styles.dockButtonActive : styles.dockButton}
                onClick={() => setDock('bottom')} aria-label="Dock preview to the bottom" aria-pressed={dock === 'bottom'}>
                <PanelBottom size={17} aria-hidden />
              </button>
              <button type="button" className={dock === 'right' ? styles.dockButtonActive : styles.dockButton}
                onClick={() => setDock('right')} aria-label="Dock preview to the right" aria-pressed={dock === 'right'}>
                <PanelRight size={17} aria-hidden />
              </button>
            </div>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close template library">
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className={`${styles.body} ${dock === 'right' ? styles.bodyRight : styles.bodyBottom}`}>
          <aside className={styles.sidebar} aria-label="Library navigation">
            <div className={styles.sidebarLabel}>Library</div>
            <nav aria-label="Template categories">
              {categories.map((item: SampleLibraryCategory) => (
                <button key={item.id} type="button"
                  className={`${styles.categoryButton} ${category === item.id ? styles.categoryButtonActive : ''}`}
                  aria-pressed={category === item.id} title={`Source samples ${item.description}`}
                  onClick={() => { setCategory(item.id); setQuery(''); setSelectedId(null); }}>
                  <CategoryIcon category={item.id} />
                  <span>{item.label}</span>
                  <span className={styles.categoryCount}>{item.entryCount}</span>
                </button>
              ))}
            </nav>
          </aside>

          <section className={styles.results} aria-label="Template browser">
            <div className={styles.resultsHeader}>
              <div>
                <div className={styles.resultsKicker}>{categoryLabel}</div>
                <h3>Templates ({visibleEntries.length})</h3>
              </div>
              <div className={styles.resultsControls}>
                <label className={styles.draftToggle}>
                  <input type="checkbox" checked={includeDrafts}
                    onChange={(event) => setIncludeDrafts(event.target.checked)} />
                  Include unvalidated drafts
                </label>
                <label className={styles.plannedToggle}>
                  <input type="checkbox" checked={includePlanned}
                    onChange={(event) => setIncludePlanned(event.target.checked)} />
                  Include planned samples
                </label>
                <span className={styles.resultsHint}>
                  {includeDrafts ? 'Unvalidated drafts included' : 'Showing reviewed and featured samples'}
                </span>
                <span className={styles.resultsHint}>Search is within this category</span>
              </div>
            </div>

            {indexState.status === 'loading' || (indexState.status === 'ready' && shardState.status === 'loading') ? (
              <div className={styles.emptyState} role="status">Loading catalog…</div>
            ) : indexState.status === 'error' ? (
              <div className={styles.emptyState} role="alert">
                <strong>Could not load the template catalog.</strong><span>{indexState.error}</span>
                <button type="button" className={styles.secondaryButton} onClick={retryIndex}>Retry</button>
              </div>
            ) : shardState.status === 'error' ? (
              <div className={styles.emptyState} role="alert">
                <strong>Could not load this category.</strong><span>{shardState.error}</span>
                <button type="button" className={styles.secondaryButton} onClick={retryShard}>Retry</button>
              </div>
            ) : visibleEntries.length ? (
              <div className={styles.templateTable}>
                <div className={styles.tableHeader} aria-hidden>
                  <span>Preview</span><span>Name <span className={styles.sortArrow}>▲</span></span><span>Source</span><span>Description</span>
                </div>
                <div className={styles.templateRows}>
                  {visibleEntries.map((entry) => {
                    const active = selectedEntry?.id === entry.id;
                    const editable = canEdit(entry);
                    return (
                      <button key={entry.id} type="button"
                        className={`${styles.templateRow} ${active ? styles.templateRowActive : ''}`}
                        aria-pressed={active} onClick={() => setSelectedId(entry.id)}
                        onDoubleClick={() => { if (editable) onPick(entry); }} title={`${entry.title} — ${entry.description}`}>
                        <span className={styles.previewCell}><SampleThumbnail entry={entry} theme={theme} /></span>
                        <span className={styles.nameCell}>
                          <span className={styles.nameText}>{entry.title}</span>
                          <ContentStatusBadge entry={entry} />
                        </span>
                        <span className={styles.sourceCell}>{entry.source}</span>
                        <span className={styles.descriptionCell}>{entry.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>{query ? `No templates match “${query}”.` : 'No validated templates in this category.'}</strong>
                {query ? (
                  <button type="button" className={styles.secondaryButton} onClick={() => setQuery('')}>Clear search</button>
                ) : !includeDrafts && entries.some((entry) => entry.contentStatus === 'draft') ? (
                  <button type="button" className={styles.secondaryButton} onClick={() => setIncludeDrafts(true)}>
                    Show unvalidated drafts
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <TemplatePreview entry={selectedEntry} theme={theme} onPick={onPick} />
        </div>

        <footer className={styles.footer}>
          <span>{indexState.status === 'ready' ? `${indexState.value.entryCount} catalog entries` : 'Catalog loading'}</span>
          <span className={styles.footerHint}>Double-click an available template to open</span>
        </footer>
      </div>
    </div>
  );
}
