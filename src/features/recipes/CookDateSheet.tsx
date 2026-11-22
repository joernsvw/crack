import { useState, type FormEvent } from 'react'
import { ErrorBox, Sheet } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { cookedAtFromDate, todayInputValue } from './overview'

/** "Gekocht" mit frei waehlbarem Tag, zum Beispiel fuer gestern Abend oder zum Nachtragen. */
export function CookDateSheet({
  householdId,
  recipeId,
  title,
  onClose,
  onSaved,
}: {
  householdId: string
  recipeId: string
  title: string
  onClose: () => void
  onSaved: () => void
}) {
  const today = todayInputValue()
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase
      .from('cook_history')
      .insert({ household_id: householdId, recipe_id: recipeId, cooked_at: cookedAtFromDate(date) })
    if (insertError) {
      setError(navigator.onLine ? insertError.message : 'Dafür brauchst du eine Internetverbindung.')
      setBusy(false)
      return
    }
    onSaved()
  }

  return (
    <Sheet title="Gekocht am" onClose={onClose}>
      <form className="space-y-3" onSubmit={save}>
        <p className="text-muted">{title}</p>
        <input
          className="input"
          type="date"
          aria-label="Datum"
          required
          max={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {[
            ['Heute', 0],
            ['Gestern', 1],
            ['Vorgestern', 2],
          ].map(([label, days]) => {
            const value = todayInputValue(new Date(Date.now() - (days as number) * 86_400_000))
            return (
              <button key={label} type="button" className={`chip ${date === value ? 'chip-active' : ''}`} onClick={() => setDate(value)}>
                {label}
              </button>
            )
          })}
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn btn-primary w-full" disabled={busy || !date}>
          Speichern
        </button>
      </form>
    </Sheet>
  )
}
