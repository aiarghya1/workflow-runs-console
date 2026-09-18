import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  DARK_QUERY,
  readPreference,
  resolveTheme,
  savePreference,
  type ThemePreference,
} from '../lib/theme';

/** Light / dark / system theme; "system" tracks OS changes live while the page is open. */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(preference, systemDark);
  useEffect(() => applyTheme(theme), [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    savePreference(next);
  }, []);

  return { preference, theme, setPreference };
}
