// ============================================================================
// Lightweight Zero-Dependency In-Memory API Cache
// Ponytail Rules: Native Map-based cache, zero bundle bloat, zero dependencies.
// ============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttlMs: number
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>()

  /**
   * Retrieve valid cached data if not expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    const isExpired = Date.now() - entry.timestamp > entry.ttlMs
    if (isExpired) {
      this.cache.delete(key)
      return undefined
    }

    return entry.data as T
  }

  /**
   * Retrieve cached data with stale state flag for Stale-While-Revalidate (SWR).
   */
  getStale<T>(key: string): { data: T; isStale: boolean } | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    const isStale = Date.now() - entry.timestamp > entry.ttlMs
    return {
      data: entry.data as T,
      isStale,
    }
  }

  /**
   * Store data in cache with a TTL (default: 30 seconds).
   */
  set<T>(key: string, data: T, ttlMs: number = 30_000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs,
    })
  }

  /**
   * Invalidate cache entries by exact key, prefix, or regular expression.
   */
  invalidate(target?: string | RegExp): void {
    if (!target) {
      this.cache.clear()
      return
    }

    for (const key of this.cache.keys()) {
      if (typeof target === "string") {
        if (key === target || key.startsWith(target)) {
          this.cache.delete(key)
        }
      } else if (target.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Automatically invalidate dependent resource caches based on mutation endpoints.
   */
  invalidateOnMutation(mutationUrl: string): void {
    const cleanUrl = mutationUrl.toLowerCase()

    if (cleanUrl.includes("/sales")) {
      this.invalidate("/sales")
      this.invalidate("/inventory")
      this.invalidate("/dashboard")
      this.invalidate("/customers")
    } else if (cleanUrl.includes("/returns")) {
      this.invalidate("/returns")
      this.invalidate("/sales")
      this.invalidate("/inventory")
      this.invalidate("/dashboard")
      this.invalidate("/customers")
    } else if (cleanUrl.includes("/customers")) {
      this.invalidate("/customers")
      this.invalidate("/dashboard")
    } else if (cleanUrl.includes("/inventory") || cleanUrl.includes("/products")) {
      this.invalidate("/inventory")
      this.invalidate("/products")
      this.invalidate("/dashboard")
    }
  }

  /**
   * Clear entire in-memory cache.
   */
  clear(): void {
    this.cache.clear()
  }
}

export const apiCache = new ApiCache()
