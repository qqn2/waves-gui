import { getSafeStorage } from '../shell/soloDesk/safeStorage';

export type Theme = 'light' | 'light-grey';

export const THEME_STORAGE_KEY = 'wavedrom-gui-theme';

export const THEME_SETTINGS_VERSION = 2 as const;

export interface ThemeSettings {
  version: typeof THEME_SETTINGS_VERSION;
  theme: Theme;
  /** Override preset accent; null = use theme default. */
  accentColor: string | null;
  /** Override waveform canvas background; null = use theme default. */
  canvasColor: string | null;
  /** Body font scale multiplier (0.9–1.15). */
  uiFontScale: number;
}

export interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'White panels, bright canvas',
  },
  {
    id: 'light-grey',
    label: 'Light grey',
    description: 'Soft grey chrome — easier on the eyes',
  },
];

/** Quick-pick accent colors (hardware-doc friendly). */
export const ACCENT_PRESETS: { id: string; hex: string; label: string }[] = [
  { id: 'blue', hex: '#2563eb', label: 'Blue' },
  { id: 'teal', hex: '#0d9488', label: 'Teal' },
  { id: 'violet', hex: '#7c3aed', label: 'Violet' },
  { id: 'orange', hex: '#ea580c', label: 'Orange' },
  { id: 'rose', hex: '#e11d48', label: 'Rose' },
  { id: 'slate', hex: '#475569', label: 'Slate' },
];

export const CANVAS_PRESETS: { id: string; hex: string; label: string }[] = [
  { id: 'default', hex: '', label: 'Theme default' },
  { id: 'white', hex: '#ffffff', label: 'White' },
  { id: 'warm', hex: '#faf8f5', label: 'Warm' },
  { id: 'cool', hex: '#f5f8fa', label: 'Cool' },
  { id: 'grid', hex: '#f0f0f0', label: 'Light grey' },
];

export const UI_FONT_SCALES = [
  { id: 'sm', value: 0.9, label: 'S' },
  { id: 'md', value: 1, label: 'M' },
  { id: 'lg', value: 1.1, label: 'L' },
] as const;

const VALID: Theme[] = ['light', 'light-grey'];

const LEGACY_DARK = new Set(['dark', 'dark-grey', 'dark-hc']);
const LEGACY_LIGHT = new Set(['light', 'light-hc']);

export function defaultThemeSettings(): ThemeSettings {
  return {
    version: THEME_SETTINGS_VERSION,
    theme: 'light',
    accentColor: null,
    canvasColor: null,
    uiFontScale: 1,
  };
}

function clampFontScale(n: number): number {
  return Math.max(0.9, Math.min(1.15, n));
}

function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const h = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  return null;
}

export function normalizeThemeSettings(
  raw: Partial<ThemeSettings> | null | undefined,
): ThemeSettings {
  const base = defaultThemeSettings();
  if (!raw || typeof raw !== 'object') return base;

  const theme = VALID.includes(raw.theme as Theme) ? (raw.theme as Theme) : base.theme;

  return {
    version: THEME_SETTINGS_VERSION,
    theme,
    accentColor: normalizeHex(raw.accentColor),
    canvasColor: normalizeHex(raw.canvasColor),
    uiFontScale:
      typeof raw.uiFontScale === 'number' && Number.isFinite(raw.uiFontScale)
        ? clampFontScale(raw.uiFontScale)
        : base.uiFontScale,
  };
}

/** Map legacy v1 theme string to a base preset. */
export function migrateLegacyTheme(raw: string): Theme {
  if (VALID.includes(raw as Theme)) return raw as Theme;
  if (LEGACY_DARK.has(raw)) return 'light-grey';
  if (LEGACY_LIGHT.has(raw)) return 'light';
  return 'light';
}

export function loadThemeSettings(): ThemeSettings {
  try {
    const raw = getSafeStorage().getItem(THEME_STORAGE_KEY);
    if (!raw) return defaultThemeSettings();

    try {
      const parsed = JSON.parse(raw) as Partial<ThemeSettings>;
      if (parsed && typeof parsed === 'object' && parsed.version === THEME_SETTINGS_VERSION) {
        return normalizeThemeSettings(parsed);
      }
    } catch {
      /* v1 plain string */
    }

    return normalizeThemeSettings({ theme: migrateLegacyTheme(raw) });
  } catch {
    return defaultThemeSettings();
  }
}

export function saveThemeSettings(settings: ThemeSettings): void {
  try {
    const next = normalizeThemeSettings(settings);
    getSafeStorage().setItem(THEME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(m[1]!, 16),
    g: parseInt(m[2]!, 16),
    b: parseInt(m[3]!, 16),
  };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

const ACCENT_DERIVED: Array<{ prop: string; alpha?: number }> = [
  { prop: '--accent' },
  { prop: '--signal-default' },
  { prop: '--signal-high' },
  { prop: '--selection-stroke' },
  { prop: '--selection-fill', alpha: 0.14 },
  { prop: '--pointer-marker', alpha: 0.35 },
  { prop: '--pointer-marker-row', alpha: 0.1 },
];

/** Apply base preset + user overrides to the document root. */
export function applyThemeSettings(settings: ThemeSettings): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;

  const style = root.style;
  style.setProperty('--ui-font-scale', String(settings.uiFontScale));

  if (settings.canvasColor) {
    style.setProperty('--bg-canvas', settings.canvasColor);
  } else {
    style.removeProperty('--bg-canvas');
  }

  if (settings.accentColor) {
    const accent = settings.accentColor;
    for (const { prop, alpha } of ACCENT_DERIVED) {
      style.setProperty(prop, alpha === undefined ? accent : withAlpha(accent, alpha));
    }
  } else {
    for (const { prop } of ACCENT_DERIVED) {
      style.removeProperty(prop);
    }
  }
}

/** @deprecated use loadThemeSettings().theme */
export function loadStoredTheme(): Theme | null {
  return loadThemeSettings().theme;
}

/** @deprecated use saveThemeSettings */
export function saveStoredTheme(theme: Theme): void {
  const current = loadThemeSettings();
  saveThemeSettings({ ...current, theme });
}

export function themeSettingsFromView(view: {
  theme: Theme;
  accentColor: string | null;
  canvasColor: string | null;
  uiFontScale: number;
}): ThemeSettings {
  return normalizeThemeSettings(view);
}
