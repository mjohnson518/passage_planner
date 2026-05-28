/**
 * Performance optimization utilities
 */

// Request deduplication
const requestCache = new Map<string, Promise<any>>();

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = 5000,
): Promise<T> {
  const cached = requestCache.get(key);
  if (cached) return cached;

  const promise = fetcher();
  requestCache.set(key, promise);

  // Clean up after TTL
  setTimeout(() => requestCache.delete(key), ttl);

  try {
    return await promise;
  } catch (error) {
    requestCache.delete(key);
    throw error;
  }
}
