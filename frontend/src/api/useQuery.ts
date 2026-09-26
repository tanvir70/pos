import { useCallback, useEffect, useRef, useState } from "react"
import { apiCache } from "./cache"

export interface UseQueryOptions<T> {
  ttlMs?: number
  enabled?: boolean
  onSuccess?: (data: T) => void
  onError?: (err: Error) => void
}

export interface UseQueryResult<T> {
  data: T | null
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: (forceRefresh?: boolean) => Promise<T | null>
}

/**
 * Lightweight SWR (Stale-While-Revalidate) Query Hook.
 * Ponytail Rules: Zero-dependency React hook, instant cached rendering, background revalidation.
 */
export function useQuery<T>(
  queryKey: string,
  fetcher: () => Promise<T>,
  options: UseQueryOptions<T> = {},
): UseQueryResult<T> {
  const { ttlMs = 30_000, enabled = true, onSuccess, onError } = options

  // 1. Initial State: Synchronously check in-memory cache to eliminate loading flickers
  const cached = apiCache.getStale<T>(queryKey)
  const [data, setData] = useState<T | null>(cached ? cached.data : null)
  const [isLoading, setIsLoading] = useState<boolean>(!cached && enabled)
  const [isFetching, setIsFetching] = useState<boolean>(Boolean(enabled && (!cached || cached.isStale)))
  const [error, setError] = useState<Error | null>(null)

  const isMountedRef = useRef<boolean>(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const executeFetch = useCallback(
    async (forceRefresh = false): Promise<T | null> => {
      if (!queryKey) return null

      if (forceRefresh) {
        apiCache.invalidate(queryKey)
      } else {
        const fresh = apiCache.get<T>(queryKey)
        if (fresh !== undefined) {
          if (isMountedRef.current) {
            setData(fresh)
            setIsLoading(false)
            setIsFetching(false)
          }
          return fresh
        }
      }

      if (isMountedRef.current) {
        setIsFetching(true)
        if (!data) setIsLoading(true)
      }

      try {
        const result = await fetcherRef.current()
        if (isMountedRef.current) {
          apiCache.set<T>(queryKey, result, ttlMs)
          setData(result)
          setError(null)
          setIsLoading(false)
          setIsFetching(false)
          onSuccess?.(result)
        }
        return result
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        if (isMountedRef.current) {
          setError(errorObj)
          setIsLoading(false)
          setIsFetching(false)
          onError?.(errorObj)
        }
        return null
      }
    },
    [queryKey, ttlMs, data, onSuccess, onError],
  )

  useEffect(() => {
    isMountedRef.current = true
    if (!enabled) return

    // Revalidate if no cache or if cached data is stale
    const currentCached = apiCache.getStale<T>(queryKey)
    if (!currentCached || currentCached.isStale) {
      executeFetch(false)
    }

    return () => {
      isMountedRef.current = false
    }
  }, [queryKey, enabled, executeFetch])

  const refetch = useCallback(
    (forceRefresh = true) => executeFetch(forceRefresh),
    [executeFetch],
  )

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  }
}
