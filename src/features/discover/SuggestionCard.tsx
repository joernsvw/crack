import { useState } from 'react'
import { Bookmark, ExternalLink, Hash, ImageOff, ThumbsDown } from 'lucide-react'
import { ErrorBox } from '../../components/ui'
import type { Suggestion } from '../../lib/types'
import { saveSuggestionAsRecipe, sendFeedback } from './data'
import { searchLinks, tiktokTagLink } from './logic'

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
  const [copied, setCopied] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const tag = tiktokTagLink(suggestion.name)
  const image = suggestion.image && !imageFailed ? suggestion.image : null

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

  // Die TikTok-App uebernimmt den Suchbegriff nicht immer. Im Zwischenspeicher liegt er dann zum Einfuegen bereit.
  const copyQuery = (text: string | null) => {
    if (!text) return
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => undefined,
    )
  }

  return (
    <article className="card fade-in overflow-hidden">
      <div className="relative flex aspect-[16/9] items-center justify-center bg-surface-2 text-muted">
        {image ? (
          <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
        ) : (
          <ImageOff size={28} aria-hidden />
        )}
        {image && (
          <a
            href={image.page}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-0 right-0 max-w-[85%] truncate rounded-tl-lg bg-black/55 px-2 py-1 text-[11px] text-white"
          >
            Foto: {image.credit} · {image.provider}
            {image.license ? ` · ${image.license}` : ''}
          </a>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold leading-snug">{suggestion.name}</h3>
        {suggestion.description && <p className="mt-1">{suggestion.description}</p>}
        {suggestion.why && <p className="mt-2 text-sm text-primary-soft-ink">{suggestion.why}</p>}
        {suggestion.main_ingredients.length > 0 && (
          <p className="mt-2 text-sm text-muted">{suggestion.main_ingredients.join(' · ')}</p>
        )}
        {suggestion.adaptation && <p className="mt-1 text-sm text-muted">Tipp: {suggestion.adaptation}</p>}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {searchLinks(suggestion.name).map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-soft !px-1 text-sm"
              onClick={() => copyQuery(link.copy)}
            >
              <ExternalLink size={14} aria-hidden /> {link.label}
            </a>
          ))}
        </div>
        {tag && (
          <a href={tag.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary">
            <Hash size={14} aria-hidden /> Videos zu {tag.label} auf TikTok
          </a>
        )}
        {copied && (
          <p className="mt-1 text-xs text-muted" role="status">
            Suchbegriff kopiert. Ist das Suchfeld in der App leer, füge ihn dort ein.
          </p>
        )}
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
      </div>
    </article>
  )
}
