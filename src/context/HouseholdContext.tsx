import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRealtime } from '../hooks/useRealtime'
import { readCache, writeCache } from '../lib/cache'
import { supabase } from '../lib/supabase'
import type { Household, Member } from '../lib/types'
import { useAuth } from './AuthContext'

interface HouseholdState {
  household: Household
  members: Member[]
}

interface HouseholdValue {
  state: HouseholdState | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const CACHE_KEY = 'household'
const HouseholdContext = createContext<HouseholdValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<HouseholdState | null>(() => readCache<HouseholdState>(CACHE_KEY))
  const [loading, setLoading] = useState(state === null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const { data: own, error: ownError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (ownError) throw ownError
      if (!own) {
        setState(null)
        writeCache(CACHE_KEY, null)
        setError(null)
        return
      }
      const [householdResult, membersResult] = await Promise.all([
        supabase.from('households').select('*').eq('id', own.household_id).single(),
        supabase.from('household_members').select('*').eq('household_id', own.household_id).order('joined_at'),
      ])
      if (householdResult.error) throw householdResult.error
      if (membersResult.error) throw membersResult.error
      const next = { household: householdResult.data as Household, members: membersResult.data as Member[] }
      setState(next)
      writeCache(CACHE_KEY, next)
      setError(null)
    } catch (err) {
      // Mit vorhandenem Cache laeuft die App weiter, zum Beispiel offline im Supermarkt.
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void reload()
  }, [reload])

  useRealtime(state?.household.id, ['household_members'], reload)

  const value = useMemo(() => ({ state, loading, error, reload }), [state, loading, error, reload])
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHouseholdContext() {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHouseholdContext braucht einen HouseholdProvider')
  return value
}

/** Fuer alle Seiten hinter dem Onboarding: Der Haushalt ist hier immer vorhanden. */
export function useHousehold() {
  const { state, reload } = useHouseholdContext()
  if (!state) throw new Error('Kein Haushalt geladen')
  const memberName = (userId: string | null) =>
    state.members.find((member) => member.user_id === userId)?.display_name ?? null
  return { ...state, householdId: state.household.id, memberName, reload }
}
