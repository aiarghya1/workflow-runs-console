type Entry<T> = { value: T; expiresAt: number };

export type IdempotencyStoreOptions = {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
};

/**
 * Bounded, expiring key/value store for idempotency keys.
 * - TTL keeps keys from living forever.
 * - maxEntries caps memory so a client cannot grow it without limit (oldest entry is evicted).
 */
export class IdempotencyStore<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: IdempotencyStoreOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
    this.now = options.now ?? Date.now;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      // Map iterates in insertion order, so the first key is the oldest.
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}
