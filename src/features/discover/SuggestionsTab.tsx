import { useState } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorBox, Spinner } from '../../components/ui'
import { formatRelativeDate } from '../../lib/format'
import { requestSuggestions, useCachedSuggestions } from './data'
import { SuggestionCard } from './SuggestionCard'

export function SuggestionsTab({ householdId }: { householdId: string }) {
  const { data, loading, error, refresh } = useCachedSuggestions(householdId)
  const [busy, setBusy] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const visible = (data?.suggestions ?? []).filter((entry) => !data?.feedback.includes(entry.name))

  const load = async () => {
    setBusy(true)
    setRequestError(null)
    setSavedId(null)
    try {
      await requestSuggestions()
      await refresh()
    } catch (err) {
      setRequestError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-3">
      {error && <ErrorBox message={error} onRetry={() => void refresh()} />}
      {requestError && <ErrorBox message={requestError} />}
      {savedId && (
        <p className="rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
          Gemerkt.{' '}
          <Link to={`/rezepte/${savedId}`} className="font-semibold underline">
            Rezept öffnen
          </Link>
        </p>
      )}

      {visible.length > 0 ? (
        <>
          {visible.map((suggestion) => (
            <SuggestionCard
              key={suggestion.name}
              suggestion={suggestion}
              householdId={householdId}
              onDone={(id) => {
                setSavedId(id)
                void refresh()
              }}
            />
          ))}
          <button className="btn btn-soft w-full" disabled={busy} onClick={() => void load()}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <RefreshCw size={18} aria-hidden />}
            {busy ? 'Crack überlegt …' : 'Neue Vorschläge'}
          </button>
          {data?.created_at && <p className="text-center text-xs text-muted">Stand: {formatRelativeDate(data.created_at)}</p>}
        </>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={data?.created_at ? 'Alle Vorschläge durch' : 'Lust auf etwas Neues?'}
          text="Crack schlägt euch Gerichte vor, passend zu euren gut bewerteten Rezepten und eurem Geschmack."
        >
          <button className="btn btn-primary" disabled={busy} onClick={() => void load()}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
            {busy ? 'Crack überlegt …' : 'Vorschläge holen'}
          </button>
        </EmptyState>
      )}
    </div>
  )
}
