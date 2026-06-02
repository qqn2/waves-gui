import { getSafeStorage } from '../shell/soloDesk/safeStorage';

export type Theme = 'dark' | 'dark-grey' | 'light' | 'dark-hc' | 'light-hc';

export const THEME_STORAGE_KEY = 'wavedrom-gui-theme';

export interface ThemeOption {
  id: Theme;
  label: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Standard light UI',
  },
  {
    id: 'light-hc',
    label: 'Light (high contrast)',
    description: 'Strong borders and text — TN / bright environments',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Darker canvas, moderate contrast',
  },
  {
    id: 'dark-grey',
    label: 'Dark (grey)',
    description: 'Soft grey chrome — easy on TN / long sessions',
  },
  {
    id: 'dark-hc',
    label: 'Dark (high contrast)',
    description: 'Pure black canvas, bright text — TN panels',
  },
];

const VALID: Theme[] = ['dark', 'dark-grey', 'light', 'dark-hc', 'light-hc'];

export function isLightTheme(theme: Theme): boolean {
  return theme === 'light' || theme === 'light-hc';
}

export function isDarkTheme(theme: Theme): boolean {
  return !isLightTheme(theme);
}

export function loadStoredTheme(): Theme | null {
  const raw = getSafeStorage().getItem(THEME_STORAGE_KEY);
  if (!raw) return null;
  return VALID.includes(raw as Theme) ? (raw as Theme) : null;
}

export function saveStoredTheme(theme: Theme): void {
  getSafeStorage().setItem(THEME_STORAGE_KEY, theme);
}
