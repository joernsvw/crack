import { useState } from 'react'
import { Ban, Star } from 'lucide-react'
import { ratingLabel } from './rating'

/** Reine Anzeige, zum Beispiel auf den Rezeptkarten. 0 Sterne heisst "nie wieder" und wird auch so angezeigt. */
export function StarsDisplay({ value, size = 14 }: { value: number | null; size?: number }) {
  if (value === null) return <span className="text-muted">Noch nicht bewertet</span>
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-danger">
        <Ban size={size} aria-hidden /> Nie wieder
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-star" aria-label={`${value} von 5 Sternen: ${ratingLabel(value)}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={size} fill={value >= star ? 'currentColor' : 'none'} aria-hidden />
      ))}
    </span>
  )
}

/**
 * Bewertung von 0 bis 5. Darunter steht, was der Wert bedeutet, auch schon beim Antippen und Ueberfahren.
 * Ein zweites Antippen desselben Werts nimmt die Bewertung wieder weg.
 */
export function StarsInput({
  value,
  onChange,
  size = 28,
  compact = false,
}: {
  value: number | null
  onChange: (rating: number | null) => void
  size?: number
  compact?: boolean
}) {
  const [preview, setPreview] = useState<number | null>(null)
  const shown = preview ?? value
  const choose = (rating: number) => onChange(value === rating ? null : rating)
  const cell = compact ? 'h-10 w-9' : 'h-11 w-11'

  return (
    <div>
      <div className="flex items-center" role="radiogroup" aria-label="Bewertung" onMouseLeave={() => setPreview(null)}>
        <button
          type="button"
          role="radio"
          aria-checked={value === 0}
          aria-label="0 Sterne: Nie wieder"
          className={`flex ${cell} items-center justify-center ${value === 0 ? 'text-danger' : 'text-muted'}`}
          onMouseEnter={() => setPreview(0)}
          onClick={() => choose(0)}
        >
          <Ban size={size - 6} aria-hidden />
        </button>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? 'Stern' : 'Sterne'}: ${ratingLabel(star)}`}
            className={`flex ${cell} items-center justify-center text-star`}
            onMouseEnter={() => setPreview(star)}
            onClick={() => choose(star)}
          >
            <Star size={size} fill={shown !== null && shown >= star ? 'currentColor' : 'none'} aria-hidden />
          </button>
        ))}
      </div>
      <p className={`${compact ? 'text-xs' : 'text-sm'} ${shown === 0 ? 'text-danger' : 'text-muted'}`} aria-live="polite">
        {ratingLabel(shown)}
      </p>
    </div>
  )
}
