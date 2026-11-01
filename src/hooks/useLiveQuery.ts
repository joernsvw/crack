import { useCallback, useEffect, useRef, useState } from 'react'
import { readCache, writeCache } from '../lib/cache'
import { useRealtime } from './useRealtime'

interface Options<T> {
  householdId: string | undefined
  key: string
  tables: string[]
  fetcher: () => Promise<T>
}

/** Laedt Daten, haelt sie per Realtime aktuell und zeigt offline den letzten Stand. */
export function useLiveQuery<T>({ householdId, key, tables, fetcher }: Options<T>) {
  const cacheKey = `${householdId}:${key}`
  const [data, setData] = useState<T | null>(() => readCache<T>(cacheKey))
  const [loading, setLoading] = useState(data === null)
  const [error, setError] = useState<string | null>(null)
  const latestFetcher = useRef(fetcher)
  latestFetcher.current = fetcher
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++requestId.current
    try {
      const result = await latestFetcher.current()
      if (id !== requestId.current) return
      setData(result)
      setError(null)
      writeCache(cacheKey, result)
    } catch (err) {
      if (id !== requestId.current) return
      setError(navigator.onLine ? (err as Error).message : null)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [cacheKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRealtime(householdId, tables, refresh)

  return { data, loading, error, refresh, setData }
}
