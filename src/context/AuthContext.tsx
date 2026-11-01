import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { clearAllCaches, readCache, writeCache } from '../lib/cache'
import { isConfigured, supabase } from '../lib/supabase'

interface AuthUser {
  id: string
  email: string | null
}

interface AuthValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const USER_KEY = 'user'
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(isConfigured)

  useEffect(() => {
    if (!isConfigured) return
    const remember = (next: AuthUser) => {
      writeCache(USER_KEY, next)
      setUser(next)
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) {
        remember({ id: data.session.user.id, email: data.session.user.email ?? null })
      } else if (isAuthRetryableFetchError(error) || !navigator.onLine) {
        // Token abgelaufen und kein Netz: Das ist keine Abmeldung. Die Einkaufsliste muss offline nutzbar bleiben.
        setUser(readCache<AuthUser>(USER_KEY))
      }
      setLoading(false)
    })

    // Kein await auf Supabase-Aufrufe in diesem Callback, das kann laut Doku blockieren.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        remember({ id: session.user.id, email: session.user.email ?? null })
      } else if (event === 'SIGNED_OUT') {
        clearAllCaches()
        setUser(null)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (!error) return null
        if (isAuthRetryableFetchError(error)) return 'Keine Verbindung. Bitte prüfe dein Internet.'
        return 'E-Mail oder Passwort stimmen nicht.'
      },
      signOut: async () => {
        await supabase.auth.signOut({ scope: 'local' })
        clearAllCaches()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth braucht einen AuthProvider')
  return value
}
