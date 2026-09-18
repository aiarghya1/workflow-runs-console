export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Theme = 'light' | 'dark';

/** Keep in sync with the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'workflow-ops:theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

const isPreference = (value: unknown): value is ThemePreference =>
  THEME_PREFERENCES.includes(value as ThemePreference);

/** Storage can be missing or throw (private mode, blocked site data); fall back to following the system. */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function savePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
}

export const resolveTheme = (preference: ThemePreference, systemDark: boolean): Theme =>
  preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
