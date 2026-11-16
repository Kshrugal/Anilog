// In-memory public metadata only; never use this cache for account/library reads.
export function createMediaCache<T>({ ttlMs = 5 * 60_000, maxEntries = 100, now = Date.now } = {}) {
  if (!(ttlMs > 0) || !Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError('Cache TTL and capacity must be positive');
  }
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();

  function get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = entries.get(key);
    if (cached && cached.expiresAt > now()) {
      entries.delete(key);
      entries.set(key, cached);
      return Promise.resolve(cached.value);
    }
    entries.delete(key);
    const active = pending.get(key);
    if (active) return active;

    const request = Promise.resolve().then(load).then(value => {
      const timestamp = now();
      for (const [id, entry] of entries) {
        if (entry.expiresAt <= timestamp) entries.delete(id);
      }
      entries.set(key, { value, expiresAt: timestamp + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }

  return { get };
}

export const mediaDetailsCache = createMediaCache<any>();
