import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRealtime } from '../../hooks/useRealtime'
import { readCache, writeCache } from '../../lib/cache'
import { isRetryableError, supabase } from '../../lib/supabase'
import type { ShoppingItem } from '../../lib/types'
import { suggestCategory, type ParsedItem } from './catalog'
import { applyOps, type Op } from './outbox'

const RETRY_INTERVAL = 30_000

async function send(op: Op) {
  switch (op.kind) {
    case 'insert':
      // Idempotent: Kam die Antwort beim letzten Versuch nicht an, entsteht kein Duplikat.
      return supabase.from('shopping_items').upsert(op.rows, { onConflict: 'id', ignoreDuplicates: true })
    case 'update':
      return supabase.from('shopping_items').update(op.patch).eq('id', op.id)
    case 'delete':
      return supabase.from('shopping_items').delete().in('id', op.ids)
  }
}

export function useShopping(householdId: string, userId: string) {
  const itemsKey = `${householdId}:shopping`
  const opsKey = `${householdId}:shopping-outbox`

  const [server, setServer] = useState<ShoppingItem[]>(() => readCache<ShoppingItem[]>(itemsKey) ?? [])
  const [ops, setOps] = useState<Op[]>(() => readCache<Op[]>(opsKey) ?? [])
  const [loading, setLoading] = useState(() => readCache(itemsKey) === null)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  // Der erste Abgleich mit dem Server ist durch, erfolgreich oder nicht. Bis dahin zeigt items den gespeicherten Stand.
  const [settled, setSettled] = useState(false)

  const opsRef = useRef(ops)
  const flushing = useRef(false)
  const fetchId = useRef(0)

  const storeOps = useCallback(
    (next: Op[]) => {
      opsRef.current = next
      setOps(next)
      writeCache(opsKey, next)
    },
    [opsKey],
  )

  const refresh = useCallback(async () => {
    const id = ++fetchId.current
    const { data, error: fetchError, status } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at')
    if (id !== fetchId.current) return
    setLoading(false)
    setSettled(true)
    if (fetchError) {
      const retryable = isRetryableError({ message: fetchError.message, code: fetchError.code, status })
      if (!retryable) setError(fetchError.message)
      return
    }
    setServer(data as ShoppingItem[])
    writeCache(itemsKey, data)
  }, [householdId, itemsKey])

  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (opsRef.current.length > 0) {
        const result = await send(opsRef.current[0])
        const opError = result.error
        if (opError) {
          const retryable = isRetryableError({ message: opError.message, code: opError.code, status: result.status })
          // Offline oder Token abgelaufen: Die Aenderung bleibt gespeichert und geht spaeter raus.
          if (retryable) {
            setSettled(true)
            return
          }
          setError(`Eine Änderung konnte nicht gespeichert werden: ${opError.message}`)
        }
        storeOps(opsRef.current.slice(1))
      }
    } finally {
      flushing.current = false
    }
    await refresh()
  }, [refresh, storeOps])

  useEffect(() => {
    void flush()
  }, [flush])

  useRealtime(householdId, ['shopping_items'], refresh)

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      void flush()
    }
    const onOffline = () => setOnline(false)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    // Ein frisches Token kann haengengebliebene Aenderungen wieder freigeben.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') setTimeout(() => void flush(), 0)
    })
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      data.subscription.unsubscribe()
    }
  }, [flush])

  // Wackliges Netz im Supermarkt: Das Handy meldet "online", die Anfrage scheitert trotzdem.
  const hasPending = ops.length > 0
  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => void flush(), RETRY_INTERVAL)
    return () => clearInterval(timer)
  }, [hasPending, flush])

  const enqueue = useCallback(
    (op: Op) => {
      storeOps([...opsRef.current, op])
      void flush()
    },
    [flush, storeOps],
  )

  const items = useMemo(() => applyOps(server, ops), [server, ops])

  const actions = useMemo(
    () => ({
      add: (parsed: ParsedItem[]) => {
        const now = Date.now()
        enqueue({
          kind: 'insert',
          rows: parsed.map((item, index) => ({
            id: crypto.randomUUID(),
            household_id: householdId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: suggestCategory(item.name),
            checked: false,
            checked_at: null,
            created_by: userId,
            // Eigener Zeitstempel je Eintrag, damit die Eingabe-Reihenfolge erhalten bleibt.
            created_at: new Date(now + index).toISOString(),
          })),
        })
      },
      toggle: (item: ShoppingItem) => {
        const checked = !item.checked
        enqueue({
          kind: 'update',
          id: item.id,
          patch: { checked, checked_at: checked ? new Date().toISOString() : null },
        })
      },
      update: (id: string, patch: Partial<ShoppingItem>) => enqueue({ kind: 'update', id, patch }),
      remove: (ids: string[]) => enqueue({ kind: 'delete', ids }),
    }),
    [enqueue, householdId, userId],
  )

  return { items, loading, settled, error, online, pending: ops.length, clearError: () => setError(null), ...actions }
}
