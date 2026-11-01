import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// Ohne Konfiguration zeigt App.tsx einen Hinweis und nutzt diesen Client nie wirklich.
export const supabase: SupabaseClient = createClient(
  url ?? 'https://nicht-konfiguriert.invalid',
  anonKey ?? 'nicht-konfiguriert',
  {
    auth: {
      storageKey: 'crack-auth',
      persistSession: true,
      autoRefreshToken: true,
      // Die App nutzt nur E-Mail + Passwort; Tokens in der URL wuerden den HashRouter stoeren.
      detectSessionInUrl: false,
    },
  },
)

/** Fehler, nach denen sich ein erneuter Versuch lohnt: kein Netz oder abgelaufenes Token. */
export function isRetryableError(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false
  if (!navigator.onLine) return true
  const message = error.message ?? ''
  return (
    /failed to fetch|networkerror|load failed|network request failed|jwt expired/i.test(message) ||
    error.code === 'PGRST301' ||
    error.code === 'PGRST303' ||
    error.status === 0 ||
    error.status === 401 ||
    (error.status ?? 0) >= 500
  )
}
