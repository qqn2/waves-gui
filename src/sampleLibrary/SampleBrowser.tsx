import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Search, X } from 'lucide-react';
import { renderDiagramImage } from '../exportEngine/exportImage';
import { defaultView } from '../shared/store/helpers';
import { useStore } from '../shared/store';
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

type MobileStep = 'results' | 'detail';

const THUMBNAIL_PATHS = [
  'M2 34H14V14H28V34H42V20H56V34H70V10H84V34H98V23H112V34H126V16H140V34H158',
  'M2 30H18V18H34V30H50V12H66V30H82V24H98V30H114V8H130V30H146V20H158',
  'M2 34H18V26H34V18H50V26H66V10H82V26H98V18H114V26H130V14H146V34H158',
  'M2 28H22V12H42V28H62V12H82V28H102V12H122V28H142V12H158',
];

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
      <span className={styles.thumbnailLabel}>WAVEFORM</span>
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
      <span className={styles.thumbnailLabel}>SAMPLE PREVIEW</span>
    </div>
  );
}

type LoadedPreview = {
  sampleId: string;
  status: 'loading' | 'ready' | 'error';
  diagram: Awaited<ReturnType<typeof loadSamplePreview>> | null;
  error: string | null;
};

function DetailSamplePreview({
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
      .trim() || '#111111';
    void renderDiagramImage(previewDiagram, previewView, {
      format: 'png',
      scale: 0.75,
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
    <div className={styles.detailPreview}>
      {image ? (
        <img className={styles.detailPreviewImage} src={image} alt={`${entry.title} live waveform preview`} />
      ) : (
        <>
          <SampleThumbnail entry={entry} theme={theme} large />
          <span className={styles.previewNotice} role={error ? 'alert' : 'status'}>
            {error ? `Preview unavailable: ${error}` : 'Rendering detailed preview…'}
          </span>
        </>
      )}
    </div>
  );
}

function CategoryIcon({ category }: { category: SampleLibraryCategory['id'] }) {
  return (
    <span className={styles.categoryIcon} aria-hidden>
      {category === 'featured' ? '✦' : category === 'all' ? '▦' : category === 'general' ? '◌' : category === 'amba' ? '⌁' : '◇'}
    </span>
  );
}

function detailBreadcrumb(entry: SampleLibraryEntry): string {
  const path = entry.path[0] === entry.categoryLabel
    ? entry.path.slice(1)
    : entry.path;
  return [entry.categoryLabel, ...path].join(' / ');
}

export function SampleBrowser({ open, onClose, onPick }: SampleBrowserProps) {
  const theme = useStore((state) => state.view.theme);
  const [category, setCategory] = useState<SampleLibraryCategory['id']>('featured');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    SAMPLE_LIBRARY_CATALOG.find((entry) => entry.featured)?.id
      ?? SAMPLE_LIBRARY_CATALOG[0]?.id
      ?? null,
  );
  const [mobileStep, setMobileStep] = useState<MobileStep>('results');
  const [isNarrow, setIsNarrow] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const visibleEntries = useMemo(
    () => filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, category, query),
    [category, query],
  );
  const selectedEntry = visibleEntries.find((entry) => entry.id === selectedId)
    ?? visibleEntries[0]
    ?? null;

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedId(null);
      return;
    }
    if (selectedEntry.id !== selectedId) setSelectedId(selectedEntry.id);
  }, [selectedEntry, selectedId]);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => {
      setIsNarrow(media.matches);
      if (!media.matches) setMobileStep('results');
    };
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const first = dialog.querySelector<HTMLElement>('input:not([disabled])')
      ?? focusable()[0]
      ?? dialog;
    first.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  const selectEntry = (entry: SampleLibraryEntry) => {
    setSelectedId(entry.id);
    if (isNarrow) setMobileStep('detail');
  };

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
          <div className={styles.heading}>
            <div className={styles.eyebrow}>WAVES GUI / TEMPLATE LIBRARY</div>
            <h2 id="sample-browser-title">Sample library</h2>
            <p>Start with a reusable waveform block, then make it your own.</p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden />
              <span className={styles.visuallyHidden}>Search templates</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates..."
                type="search"
                aria-label="Search templates"
              />
            </label>
            <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close sample library">
              <X size={18} aria-hidden />
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={`${styles.sidebar} ${isNarrow && mobileStep !== 'results' ? styles.mobileHidden : ''}`}>
            <div className={styles.sidebarLabel}>Browse</div>
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
                      setMobileStep('results');
                    }}
                  >
                    <CategoryIcon category={item.id} />
                    <span>{item.label}</span>
                    <span className={styles.categoryCount}>{count}</span>
                  </button>
                );
              })}
            </nav>
            <div className={styles.sidebarNote}>
              <strong>Library blocks</strong>
              <span>Each template is a safe starting point. Your edits stay in the current document.</span>
            </div>
          </aside>

          <section className={`${styles.results} ${isNarrow && mobileStep !== 'results' ? styles.mobileHidden : ''}`} aria-label="Sample templates">
            <div className={styles.resultsHeader}>
              <div>
                <div className={styles.resultsKicker}>
                  {SAMPLE_LIBRARY_CATEGORIES.find((item) => item.id === category)?.label}
                </div>
                <h3>{visibleEntries.length} {visibleEntries.length === 1 ? 'template' : 'templates'}</h3>
              </div>
              <span className={styles.resultsHint}>Select a block to inspect it</span>
            </div>
            {visibleEntries.length > 0 ? (
              <div className={styles.cardGrid}>
                {visibleEntries.map((entry) => {
                  const active = selectedEntry?.id === entry.id;
                  return (
                    <article key={entry.id} className={`${styles.card} ${active ? styles.cardActive : ''}`}>
                      <button
                        type="button"
                        className={styles.cardButton}
                        aria-pressed={active}
                        onClick={() => selectEntry(entry)}
                      >
                        <SampleThumbnail entry={entry} theme={theme} />
                        <span className={styles.cardContent}>
                          <span className={styles.cardMeta}>
                            <span>{entry.categoryLabel}</span>
                            {entry.featured ? <span className={styles.featuredBadge}>Featured</span> : null}
                          </span>
                          <strong>{entry.title}</strong>
                          <span>{entry.description}</span>
                        </span>
                        <ChevronRight className={styles.cardChevron} size={16} aria-hidden />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>No templates found</strong>
                <span>Try a different search or browse all templates.</span>
                <button type="button" className={styles.secondaryButton} onClick={() => { setQuery(''); setCategory('all'); }}>
                  Clear filters
                </button>
              </div>
            )}
          </section>

          <section className={`${styles.detail} ${isNarrow && mobileStep !== 'detail' ? styles.mobileHidden : ''}`} aria-label="Selected sample details">
            {selectedEntry ? (
              <>
                {isNarrow ? (
                  <button type="button" className={styles.backButton} onClick={() => setMobileStep('results')}>
                    <ArrowLeft size={16} aria-hidden /> Back to results
                  </button>
                ) : null}
                <DetailSamplePreview entry={selectedEntry} theme={theme} />
                <div className={styles.detailPath}>{detailBreadcrumb(selectedEntry)}</div>
                <h3>{selectedEntry.title}</h3>
                <p className={styles.detailDescription}>{selectedEntry.description}</p>
                <dl className={styles.detailMeta}>
                  <div><dt>Level</dt><dd>{selectedEntry.difficulty}</dd></div>
                  <div><dt>Type</dt><dd>Waveform template</dd></div>
                </dl>
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionLabel}>Good for</div>
                  <p>Exploring {selectedEntry.title.toLocaleLowerCase()} patterns without starting from a blank canvas.</p>
                </div>
                <button type="button" className={styles.primaryButton} onClick={() => onPick(selectedEntry.id)}>
                  Edit a copy <ChevronRight size={16} aria-hidden />
                </button>
              </>
            ) : (
              <div className={styles.emptyDetail}>Choose a template to see its details.</div>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <span><strong>{SAMPLE_LIBRARY_CATALOG.length}</strong> bundled templates</span>
          <span className={styles.footerHint}>Esc to close · Enter to open the selected block</span>
        </footer>
      </div>
    </div>
  );
}
