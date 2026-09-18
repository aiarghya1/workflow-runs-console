import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '../../src/components/ThemeSwitcher';
import { applyTheme, readPreference, resolveTheme, savePreference, THEME_STORAGE_KEY } from '../../src/lib/theme';
import { systemTheme } from '../mediaQuery';

const html = document.documentElement;

describe('theme preference storage', () => {
  it('defaults to system and ignores unknown values', () => {
    expect(readPreference()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readPreference()).toBe('system');
  });

  it('round-trips a saved preference', () => {
    savePreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readPreference()).toBe('dark');
  });

  it('survives storage that throws (private mode, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(readPreference()).toBe('system');
    expect(() => savePreference('light')).not.toThrow();
  });
});

describe('resolveTheme / applyTheme', () => {
  it('uses the explicit choice, or the OS setting for system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('sets data-theme on the root element', () => {
    applyTheme('dark');
    expect(html.dataset.theme).toBe('dark');
  });
});

describe('ThemeSwitcher', () => {
  const option = (name: string) => screen.getByRole('radio', { name });

  it('defaults to System and follows the OS live', () => {
    systemTheme.dark = true;
    const { unmount } = render(<ThemeSwitcher />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(option('System')).toBeChecked();
    expect(html.dataset.theme).toBe('dark');

    act(() => systemTheme.change(false));
    expect(html.dataset.theme).toBe('light');

    unmount();
    expect(systemTheme.listeners.size).toBe(0);
  });

  it('lets the user force light or dark and remembers it', async () => {
    render(<ThemeSwitcher />);
    await userEvent.click(option('Dark'));
    expect(option('Dark')).toBeChecked();
    expect(html.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    // An explicit choice ignores OS changes.
    act(() => systemTheme.change(false));
    expect(html.dataset.theme).toBe('dark');

    await userEvent.click(option('Light'));
    expect(html.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores the saved preference on load and supports arrow keys', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    systemTheme.dark = true;
    render(<ThemeSwitcher />);
    expect(option('Light')).toBeChecked();
    expect(html.dataset.theme).toBe('light');

    option('Light').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(option('Dark')).toBeChecked();
    expect(html.dataset.theme).toBe('dark');
  });
});
