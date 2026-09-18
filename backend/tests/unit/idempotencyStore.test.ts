import { describe, expect, it } from 'vitest';
import { IdempotencyStore } from '../../src/lib/idempotencyStore';

describe('IdempotencyStore', () => {
  const create = (maxEntries = 10) => {
    let now = 0;
    const store = new IdempotencyStore<string>({ ttlMs: 100, maxEntries, now: () => now });
    return { store, advance: (ms: number) => (now += ms) };
  };

  it('returns stored values until they expire', () => {
    const { store, advance } = create();
    store.set('a', 'first');
    advance(99);
    expect(store.get('a')).toBe('first');
    advance(1);
    expect(store.get('a')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it('returns undefined for unknown keys', () => {
    expect(create().store.get('missing')).toBeUndefined();
  });

  it('evicts the oldest entry when full', () => {
    const { store } = create(2);
    store.set('a', '1');
    store.set('b', '2');
    store.set('c', '3');
    expect(store.get('a')).toBeUndefined();
    expect(store.get('b')).toBe('2');
    expect(store.get('c')).toBe('3');
    expect(store.size).toBe(2);
  });

  it('overwriting a key refreshes it without evicting others', () => {
    const { store } = create(2);
    store.set('a', '1');
    store.set('b', '2');
    store.set('a', '1b');
    expect(store.get('a')).toBe('1b');
    expect(store.get('b')).toBe('2');
  });

  it('defaults to the system clock', () => {
    const store = new IdempotencyStore<number>({ ttlMs: 60_000, maxEntries: 1 });
    store.set('k', 1);
    expect(store.get('k')).toBe(1);
  });
});
