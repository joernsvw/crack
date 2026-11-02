import { useState } from 'react'
import { Bookmark, ExternalLink, ThumbsDown } from 'lucide-react'
import { ErrorBox } from '../../components/ui'
import type { Suggestion } from '../../lib/types'
import { saveSuggestionAsRecipe, sendFeedback } from './data'
import { searchLinks } from './logic'

export function SuggestionCard({
  suggestion,
  householdId,
  onDone,
}: {
  suggestion: Suggestion
  householdId: string
  /** Wird nach "Merken" (mit Rezept-ID) oder "Interessiert mich nicht" aufgerufen. */
  onDone: (recipeId: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      onDone(await action())
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Dafür brauchst du eine Internetverbindung.')
      setBusy(false)
    }
  }

  return (
    <article className="card fade-in p-4">
      <h3 className="text-lg font-bold leading-snug">{suggestion.name}</h3>
      {suggestion.description && <p className="mt-1">{suggestion.description}</p>}
      {suggestion.why && <p className="mt-2 text-sm text-primary-soft-ink">{suggestion.why}</p>}
      {suggestion.main_ingredients.length > 0 && (
        <p className="mt-2 text-sm text-muted">{suggestion.main_ingredients.join(' · ')}</p>
      )}
      {suggestion.adaptation && <p className="mt-1 text-sm text-muted">Tipp: {suggestion.adaptation}</p>}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {searchLinks(suggestion.name).map((link) => (
          <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-soft !px-1 text-sm">
            <ExternalLink size={14} aria-hidden /> {link.label}
          </a>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          className="btn btn-primary text-sm"
          disabled={busy}
          onClick={() => void run(() => saveSuggestionAsRecipe(householdId, suggestion))}
        >
          <Bookmark size={16} aria-hidden /> Merken
        </button>
        <button
          className="btn text-sm text-muted"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await sendFeedback(householdId, suggestion.name, 'dismissed')
              return null
            })
          }
        >
          <ThumbsDown size={16} aria-hidden /> Nicht mein Fall
        </button>
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBox message={error} />
        </div>
      )}
    </article>
  )
}
