import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CenteredMessage, ErrorBox, Spinner } from './components/ui'
import { TabLayout } from './components/TabLayout'
import { UpdatePrompt } from './components/UpdatePrompt'
import { AuthProvider, useAuth } from './context/AuthContext'
import { HouseholdProvider, useHouseholdContext } from './context/HouseholdContext'
import { isConfigured } from './lib/supabase'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { ShoppingPage } from './features/shopping/ShoppingPage'
import { NotesPage } from './features/notes/NotesPage'
import { NoteEditorPage } from './features/notes/NoteEditorPage'
import { RecipesPage } from './features/recipes/RecipesPage'
import { RecipeDetailPage } from './features/recipes/RecipeDetailPage'
import { RecipeFormPage } from './features/recipes/RecipeFormPage'
import { RecipeImportPage } from './features/recipes/RecipeImportPage'
import { extractFirstUrl } from './features/recipes/importLink'

/** Android "Teilen" oeffnet die App mit ?url=... oder ?text=... (Web Share Target im Manifest). */
function readSharedLink(): string | null {
  const params = new URLSearchParams(window.location.search)
  const link = extractFirstUrl([params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' '))
  if (link) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  return link
}

// Beim Laden gemerkt, denn der Link muss eine eventuelle Anmeldung ueberstehen.
let pendingSharedLink = readSharedLink()

function StartRedirect() {
  const [link] = useState(pendingSharedLink)
  useEffect(() => {
    pendingSharedLink = null
  }, [])
  return link ? <Navigate to="/rezepte/import" replace state={{ link }} /> : <Navigate to="/einkauf" replace />
}

function Protected() {
  const { state, loading, error, reload } = useHouseholdContext()

  if (loading && !state) return <Spinner fullscreen />
  if (!state && error) {
    return (
      <CenteredMessage>
        <ErrorBox message="Dein Haushalt konnte nicht geladen werden. Bitte prüfe dein Internet." onRetry={reload} />
      </CenteredMessage>
    )
  }
  if (!state) return <OnboardingPage />

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/einkauf" element={<ShoppingPage />} />
        <Route path="/rezepte" element={<RecipesPage />} />
        <Route path="/entdecken" element={<DiscoverPage />} />
        <Route path="/notizen" element={<NotesPage />} />
      </Route>
      <Route path="/rezepte/neu" element={<RecipeFormPage />} />
      <Route path="/rezepte/import" element={<RecipeImportPage />} />
      <Route path="/rezepte/:id" element={<RecipeDetailPage />} />
      <Route path="/rezepte/:id/bearbeiten" element={<RecipeFormPage />} />
      <Route path="/notizen/:id" element={<NoteEditorPage />} />
      <Route path="/einstellungen" element={<SettingsPage />} />
      <Route path="*" element={<StartRedirect />} />
    </Routes>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner fullscreen />
  if (!user) return <LoginPage />
  return (
    // key: Nach einem Kontowechsel darf nichts vom vorherigen Konto im Speicher bleiben.
    <HouseholdProvider key={user.id}>
      <Protected />
    </HouseholdProvider>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <CenteredMessage>
        <h1 className="text-xl font-bold">Crack ist noch nicht verbunden</h1>
        <p className="mt-2 text-muted">
          Die Supabase-Zugangsdaten fehlen. Lokal gehören sie in die Datei .env.local, für die veröffentlichte App in
          die GitHub-Secrets. Die Anleitung steht in der README.
        </p>
      </CenteredMessage>
    )
  }
  return (
    <HashRouter>
      <AuthProvider>
        <Gate />
        <UpdatePrompt />
      </AuthProvider>
    </HashRouter>
  )
}
