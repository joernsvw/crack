import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

let channelCounter = 0

/**
 * Ruft onChange auf, sobald sich eine der Tabellen aendert oder die App wieder aktiv wird.
 * Handys kappen die Verbindung im Hintergrund, deshalb reicht der Realtime-Kanal allein nicht.
 */
export function useRealtime(householdId: string | undefined, tables: string[], onChange: () => void) {
  const callback = useRef(onChange)
  callback.current = onChange
  const tableKey = tables.join(',')

  useEffect(() => {
    if (!householdId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const trigger = () => {
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), 150)
    }

    // Eindeutiger Name: Zwei Seiten duerfen dieselben Tabellen beobachten, ohne sich einen Kanal zu teilen.
    let channel = supabase.channel(`${tableKey}:${householdId}:${++channelCounter}`)
    for (const table of tableKey.split(',')) {
      const filter = `household_id=eq.${householdId}`
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, trigger)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, trigger)
        // DELETE-Ereignisse lassen sich bei Supabase nicht filtern.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, trigger)
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') trigger()
    })

    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', trigger)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', trigger)
      void supabase.removeChannel(channel)
    }
  }, [householdId, tableKey])
}
