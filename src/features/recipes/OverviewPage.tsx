import { useMemo, useState } from 'react'
import { AlarmClock, CalendarDays, ImageOff, Search, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useHousehold } from '../../context/HouseholdContext'
import { readCache, writeCache } from '../../lib/cache'
import { formatRelativeDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Recipe } from '../../lib/types'
import { CookDateSheet } from './CookDateSheet'
import { useImageUrl, useRecipes } from './data'
import { lastCooked, overdueDays, overviewList, type OverviewSort, type OverviewTab } from './overview'
import { StarsInput } from './Stars'

const SORTS: { value: OverviewSort; label: string }[] = [
  { value: 'rating', label: 'Bewertung' },
  { value: 'recent', label: 'Zuletzt gekocht' },
  { value: 'name', label: 'Name' },
]

interface Prefs {
  tab: OverviewTab
  sort: OverviewSort
}

export function OverviewPage() {
  const { householdId } = useHousehold()
  const { data: recipes, loading, setData, refresh } = useRecipes(householdId)
  const [prefs, setPrefs] = useState<Prefs>(() => ({ tab: 'cooked', sort: 'rating', ...readCache<Prefs>('overview-prefs') }))
  const [search, setSearch] = useState('')
  const [cooking, setCooking] = useState<Recipe | null>(null)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    writeCache('overview-prefs', next)
  }

  // "Zuletzt gekocht" ergibt bei noch nie Gekochtem keinen Sinn.
  const sort = prefs.tab === 'saved' && prefs.sort === 'recent' ? 'rating' : prefs.sort
  const list = useMemo(() => overviewList(recipes ?? [], { tab: prefs.tab, sort, search }), [recipes, prefs.tab, sort, search])
  const counts = useMemo(
    () => ({
      cooked: (recipes ?? []).filter((recipe) => recipe.cook_history.length > 0).length,
      saved: (recipes ?? []).filter((recipe) => recipe.cook_history.length === 0).length,
    }),
    [recipes],
  )

  const rate = async (recipe: Recipe, rating: number | null) => {
    setError(null)
    setData((current) => current?.map((entry) => (entry.id === recipe.id ? { ...entry, rating } : entry)) ?? null)
    const { error: updateError } = await supabase.from('recipes').update({ rating }).eq('id', recipe.id)
    if (updateError) {
      setError(navigator.onLine ? updateError.message : 'Dafür brauchst du eine Internetverbindung.')
      await refresh()
    }
  }

  return (
    <div className="pb-10">
      <PageHeader title="Gekocht & gespeichert" back="/rezepte" />
      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(
            [
              ['cooked', `Schon gekocht (${counts.cooked})`],
              ['saved', `Noch nicht gekocht (${counts.saved})`],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              role="tab"
              aria-selected={prefs.tab === tab}
              className={`chip justify-center !px-2 ${prefs.tab === tab ? 'chip-active' : ''}`}
              onClick={() => update({ tab })}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-3 top-3.5 text-muted" aria-hidden />
          <input
            className="input !pl-9"
            type="search"
            placeholder="Gericht suchen"
            aria-label="Gericht suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Sortieren:</span>
          {SORTS.filter((option) => prefs.tab === 'cooked' || option.value !== 'recent').map((option) => (
            <button
              key={option.value}
              className={`chip ${sort === option.value ? 'chip-active' : ''}`}
              aria-pressed={sort === option.value}
              onClick={() => update({ sort: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <ErrorBox message={error} />}

        {loading && !recipes ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState
            icon={search ? Search : UtensilsCrossed}
            title={search ? 'Nichts gefunden' : prefs.tab === 'cooked' ? 'Noch nichts gekocht' : 'Alles schon mal gekocht'}
            text={prefs.tab === 'cooked' && !search ? 'Tippe bei einem Gericht auf „Gekocht“, dann erscheint es hier.' : undefined}
          />
        ) : (
          <ul className="card divide-y divide-line">
            {list.map((recipe) => (
              <OverviewRow
                key={recipe.id}
                recipe={recipe}
                onRate={(rating) => void rate(recipe, rating)}
                onCooked={() => setCooking(recipe)}
              />
            ))}
          </ul>
        )}
      </main>

      {cooking && (
        <CookDateSheet
          householdId={householdId}
          recipeId={cooking.id}
          title={cooking.title}
          onClose={() => setCooking(null)}
          onSaved={() => {
            setCooking(null)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function OverviewRow({ recipe, onRate, onCooked }: { recipe: Recipe; onRate: (rating: number | null) => void; onCooked: () => void }) {
  const imageUrl = useImageUrl(recipe.image_path)
  const last = lastCooked(recipe)
  const overdue = overdueDays(recipe)
  const count = recipe.cook_history.length

  return (
    <li className="p-3">
      <div className="flex gap-3">
        <Link to={`/rezepte/${recipe.id}`} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-muted">
          {imageUrl ? <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff size={20} aria-hidden />}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/rezepte/${recipe.id}`} className="block font-semibold leading-snug">
            {recipe.title}
          </Link>
          <p className="mt-0.5 text-sm text-muted">
            {count > 0 ? `${count}× gekocht · zuletzt ${formatRelativeDate(last, false)}` : 'Noch nie gekocht'}
          </p>
          {overdue !== null && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-soft-ink">
              <AlarmClock size={12} aria-hidden /> Überfällig, mal wieder dran
            </p>
          )}
        </div>
        <button className="btn btn-soft h-11 shrink-0 self-start !px-3 text-sm" aria-label={`${recipe.title} gekocht`} onClick={onCooked}>
          <CalendarDays size={16} aria-hidden /> Gekocht
        </button>
      </div>
      <div className="mt-1 pl-[4.75rem]">
        <StarsInput value={recipe.rating} onChange={onRate} size={22} compact />
      </div>
    </li>
  )
}
