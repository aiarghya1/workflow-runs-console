import type { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import type { ThemePreference } from '../lib/theme';
import { MonitorIcon, MoonIcon, SunIcon } from './Icons';

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <MonitorIcon /> },
];

/** Segmented control built on native radios, so arrow keys and screen readers work without extra code. */
export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  return (
    <fieldset className="segmented">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((option) => (
        <label key={option.value} className="segmented__option" title={`${option.label} theme`}>
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={preference === option.value}
            onChange={() => setPreference(option.value)}
          />
          {option.icon}
          <span className="segmented__text">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
