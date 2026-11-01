import { Star } from 'lucide-react'

/** Reine Anzeige, zum Beispiel auf den Rezeptkarten. */
export function StarsDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-star" aria-label={`${value.toFixed(1).replace('.', ',')} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={size} fill={Math.round(value) >= star ? 'currentColor' : 'none'} aria-hidden />
      ))}
    </span>
  )
}

export function StarsInput({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  return (
    <div className="flex text-star" role="radiogroup" aria-label="Deine Bewertung">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'Stern' : 'Sterne'}`}
          className="flex h-11 w-11 items-center justify-center"
          onClick={() => onChange(star)}
        >
          <Star size={28} fill={value >= star ? 'currentColor' : 'none'} aria-hidden />
        </button>
      ))}
    </div>
  )
}
