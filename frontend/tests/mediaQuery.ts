import { vi } from 'vitest';

type Listener = (event: { matches: boolean }) => void;

/** Controllable stand-in for window.matchMedia (jsdom does not implement it). */
export const systemTheme = {
  dark: false,
  listeners: new Set<Listener>(),
  reset() {
    this.dark = false;
    this.listeners.clear();
  },
  /** Simulates the OS switching between light and dark. */
  change(dark: boolean) {
    this.dark = dark;
    for (const listener of this.listeners) listener({ matches: dark });
  },
};

export function installMatchMedia() {
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return systemTheme.dark;
    },
    addEventListener: (_type: string, listener: Listener) => systemTheme.listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => systemTheme.listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
}
