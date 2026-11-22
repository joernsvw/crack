import { useEffect, useRef, useState } from 'react'
import { useHousehold } from '../../context/HouseholdContext'
import { startReading, useProspects } from './data'
import { isStuck } from './match'

const CHECK_EVERY_MS = 30_000

/**
 * Setzt haengengebliebenes Auslesen von selbst fort, sobald einer von euch die App offen hat.
 * Ohne geoeffnete App geht das nicht: Die Funktion laeuft nur im Namen einer angemeldeten Person.
 * Doppelte Starts (beide Handys gleichzeitig) faengt der Server ab, fertige Teile werden nicht neu gelesen.
 */
export function ProspectWatchdog() {
  const { householdId } = useHousehold()
  const { data: prospects, refresh } = useProspects(householdId)
  const [now, setNow] = useState(() => Date.now())
  // Je Prospekt nur einmal pro Stand versuchen, sonst wuerde jeder Durchlauf neu starten.
  const tried = useRef(new Map<string, string>())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!navigator.onLine) return
    for (const prospect of prospects ?? []) {
      if (!isStuck(prospect, now) || tried.current.get(prospect.id) === prospect.updated_at) continue
      tried.current.set(prospect.id, prospect.updated_at)
      startReading(prospect.id)
        .catch(() => undefined)
        .finally(() => void refresh())
    }
  }, [prospects, now, refresh])

  return null
}
