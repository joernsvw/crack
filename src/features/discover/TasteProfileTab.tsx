import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { ErrorBox, Spinner } from '../../components/ui'
import type { TasteProfile } from '../../lib/types'
import { useRecipes } from '../recipes/data'
import { emptyProfile, saveTasteProfile, useTasteProfile } from './data'
import { profileHints, type ProfileHint } from './logic'

const DIETS = ['vegetarisch', 'vegan', 'pescetarisch', 'glutenfrei', 'laktosefrei']

export function TasteProfileTab({ householdId }: { householdId: string }) {
  const { data, loading, refresh } = useTasteProfile(householdId)
  const { data: recipes } = useRecipes(householdId)
  const [error, setError] = useState<string | null>(null)
  const profile = { ...emptyProfile(householdId), ...data }

  const save = async (patch: Partial<TasteProfile>) => {
    setError(null)
    try {
      await saveTasteProfile(householdId, patch)
      await refresh()
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Dafür brauchst du eine Internetverbindung.')
    }
  }

  const acceptHint = (hint: ProfileHint) =>
    save({ [hint.list]: [...profile[hint.list], hint.ingredient], dismissed_hints: [...profile.dismissed_hints, hint.key] })

  if (loading) return <Spinner />
  const hints = profileHints(recipes ?? [], profile)

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}

      {hints.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-bold">Das ist uns aufgefallen</h2>
          {hints.map((hint) => (
            <div key={hint.key} className="card p-3">
              <p className="text-sm">{hint.text}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn btn-primary text-sm" onClick={() => void acceptHint(hint)}>
                  Hinzufügen
                </button>
                <button
                  className="btn text-sm text-muted"
                  onClick={() => void save({ dismissed_hints: [...profile.dismissed_hints, hint.key] })}
                >
                  Nein, danke
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <ListEditor
        title="Mögen wir gern"
        placeholder="z. B. Halloumi, Curry"
        items={profile.likes}
        onChange={(likes) => void save({ likes })}
      />
      <ListEditor
        title="Lieber vermeiden"
        placeholder="z. B. Pilze, Koriander"
        items={profile.avoids}
        onChange={(avoids) => void save({ avoids })}
      />

      <section>
        <h2 className="mb-2 font-bold">Ernährungsweise</h2>
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${!profile.diet ? 'chip-active' : ''}`} onClick={() => void save({ diet: null })}>
            Alles
          </button>
          {DIETS.map((diet) => (
            <button
              key={diet}
              className={`chip ${profile.diet === diet ? 'chip-active' : ''}`}
              aria-pressed={profile.diet === diet}
              onClick={() => void save({ diet })}
            >
              {diet}
            </button>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted">
        Crack lernt auch aus euren Bewertungen: Tragt beim Bewerten eines Rezepts unter „Beim Kochen etwas geändert?“ ein, was
        ihr weggelassen oder ausgetauscht habt.
      </p>
    </div>
  )
}

function ListEditor({
  title,
  placeholder,
  items,
  onChange,
}: {
  title: string
  placeholder: string
  items: string[]
  onChange: (next: string[]) => void
}) {
  const [input, setInput] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const added = input.split(',').map((part) => part.trim()).filter((part) => part && !items.includes(part))
    if (added.length > 0) onChange([...items, ...added])
    setInput('')
  }

  return (
    <section>
      <h2 className="mb-2 font-bold">{title}</h2>
      {items.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item}
              className="chip chip-active"
              aria-label={`${item} entfernen`}
              onClick={() => onChange(items.filter((other) => other !== item))}
            >
              {item} <X size={14} aria-hidden />
            </button>
          ))}
        </div>
      )}
      <form className="flex gap-2" onSubmit={submit}>
        <input
          className="input"
          placeholder={placeholder}
          aria-label={`${title}: hinzufügen`}
          maxLength={200}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="btn btn-soft w-11 shrink-0 !p-0" aria-label={`Zu ${title} hinzufügen`} disabled={!input.trim()}>
          <Plus size={20} />
        </button>
      </form>
    </section>
  )
}
