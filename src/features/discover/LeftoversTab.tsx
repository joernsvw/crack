import { useMemo, useState, type FormEvent } from 'react'
import { Loader2, Plus, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ErrorBox } from '../../components/ui'
import type { Suggestion } from '../../lib/types'
import { useRecipes } from '../recipes/data'
import { requestLeftoverIdeas } from './data'
import { commonIngredients, matchRecipes } from './logic'
import { SuggestionCard } from './SuggestionCard'

export function LeftoversTab({ householdId }: { householdId: string }) {
  const { data: recipes } = useRecipes(householdId)
  const [selected, setSelected] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [ideas, setIdeas] = useState<Suggestion[] | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chips = useMemo(
    () => commonIngredients(recipes ?? []).filter((chip) => !selected.includes(chip)),
    [recipes, selected],
  )
  const matches = useMemo(() => matchRecipes(recipes ?? [], selected), [recipes, selected])

  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((part) => part.trim()).filter(Boolean)
    setSelected((current) => [...current, ...parts.filter((part) => !current.includes(part))])
    setInput('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    add(input)
  }

  const askAi = async () => {
    setBusy(true)
    setError(null)
    try {
      const pending = input.trim() ? [...selected, input.trim()] : selected
      if (input.trim()) add(input)
      setIdeas(await requestLeftoverIdeas(pending))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted">Was muss weg? Tippe an, was noch da ist, oder gib es ein.</p>

      <form className="flex gap-2" onSubmit={submit}>
        <input
          className="input"
          placeholder="z. B. Reibekäse, halbe Paprika"
          aria-label="Vorhandene Zutat"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="btn btn-soft w-11 shrink-0 !p-0" aria-label="Zutat hinzufügen" disabled={!input.trim()}>
          <Plus size={20} />
        </button>
      </form>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <button
              key={item}
              className="chip chip-active"
              aria-label={`${item} entfernen`}
              onClick={() => setSelected(selected.filter((other) => other !== item))}
            >
              {item} <X size={14} aria-hidden />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button key={chip} className="chip" onClick={() => setSelected([...selected, chip])}>
            {chip}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Eure Rezepte</h2>
          {matches.length === 0 ? (
            <p className="text-sm text-muted">Dazu passt noch keines eurer Rezepte.</p>
          ) : (
            <ul className="card divide-y divide-line">
              {matches.map(({ recipe, matched, missing }) => (
                <li key={recipe.id}>
                  <Link to={`/rezepte/${recipe.id}`} className="block px-4 py-3">
                    <span className="font-semibold">{recipe.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {matched.join(', ')}
                      {missing > 0 ? ` · es fehlen noch ${missing}` : ' · alles da'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <button
        className="btn btn-primary w-full"
        disabled={busy || (selected.length === 0 && !input.trim())}
        onClick={() => void askAi()}
      >
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
        {busy ? 'Crack überlegt …' : 'Neue Ideen von der KI'}
      </button>

      {error && <ErrorBox message={error} />}
      {savedId && (
        <p className="rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
          Gemerkt.{' '}
          <Link to={`/rezepte/${savedId}`} className="font-semibold underline">
            Rezept öffnen
          </Link>
        </p>
      )}

      {ideas && (
        <section className="space-y-3">
          <h2 className="font-bold">Neue Ideen</h2>
          {ideas.length === 0 && <p className="text-sm text-muted">Dazu ist der KI gerade nichts Passendes eingefallen.</p>}
          {ideas.map((suggestion) => (
            <SuggestionCard
              key={suggestion.name}
              suggestion={suggestion}
              householdId={householdId}
              onDone={(id) => {
                setSavedId(id)
                setIdeas((current) => current?.filter((entry) => entry.name !== suggestion.name) ?? null)
              }}
            />
          ))}
        </section>
      )}
    </div>
  )
}
