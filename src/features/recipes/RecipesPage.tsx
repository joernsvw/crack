import { useMemo, useState } from 'react'
import { BookOpen, Clock, Dices, ImageOff, Link2, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useHousehold } from '../../context/HouseholdContext'
import type { Recipe } from '../../lib/types'
import { averageRating, useCategories, useImageUrl, useRecipes, useTags } from './data'
import { EMPTY_FILTER, filterRecipes, type RecipeFilter } from './filter'
import { StarsDisplay } from './Stars'

export function RecipesPage() {
  const { householdId } = useHousehold()
  const { data: recipes, loading, error, refresh } = useRecipes(householdId)
  const { data: categories } = useCategories(householdId)
  const { data: tags } = useTags(householdId)
  const [filter, setFilter] = useState<RecipeFilter>(EMPTY_FILTER)
  const [showFilters, setShowFilters] = useState(false)

  const update = (patch: Partial<RecipeFilter>) => setFilter((current) => ({ ...current, ...patch }))
  const visible = useMemo(() => filterRecipes(recipes ?? [], filter), [recipes, filter])
  const extraFilters = filter.tagIds.length + (filter.minStars > 0 ? 1 : 0) + (filter.ingredient.trim() ? 1 : 0) + (filter.notCooked ? 1 : 0)

  return (
    <>
      <PageHeader
        title="Rezepte"
        settings
        actions={
          <Link to="/rezepte/neu" className="icon-btn text-primary" aria-label="Neues Rezept">
            <Plus size={26} />
          </Link>
        }
      />
      <main className="mx-auto max-w-2xl px-4">
        <div className="mb-3 grid gap-2">
          <Link to="/rezepte/rad" className="btn btn-primary w-full">
            <Dices size={20} aria-hidden /> Was essen wir heute?
          </Link>
          <Link to="/rezepte/import" className="btn btn-soft w-full">
            <Link2 size={20} aria-hidden /> Rezept per Link hinzufügen
          </Link>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-3.5 text-muted" aria-hidden />
            <input
              className="input !pl-9"
              type="search"
              placeholder="Rezept suchen"
              aria-label="Rezept suchen"
              value={filter.search}
              onChange={(event) => update({ search: event.target.value })}
            />
          </div>
          <button
            className={`btn w-11 shrink-0 !p-0 ${extraFilters > 0 ? 'btn-primary' : 'btn-soft'}`}
            aria-label={`Filter${extraFilters > 0 ? ` (${extraFilters} aktiv)` : ''}`}
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <button className={`chip ${filter.categoryId === null ? 'chip-active' : ''}`} onClick={() => update({ categoryId: null })}>
            Alle
          </button>
          {(categories ?? []).map((category) => (
            <button
              key={category.id}
              className={`chip ${filter.categoryId === category.id ? 'chip-active' : ''}`}
              onClick={() => update({ categoryId: category.id })}
            >
              {category.name}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="card fade-in mt-3 space-y-4 p-4">
            <div>
              <label className="label" htmlFor="filter-ingredient">
                Zutat
              </label>
              <input
                id="filter-ingredient"
                className="input"
                placeholder="z. B. Paprika"
                value={filter.ingredient}
                onChange={(event) => update({ ingredient: event.target.value })}
              />
            </div>
            <div>
              <span className="label">Mindestens</span>
              <div className="flex flex-wrap gap-2">
                {[0, 3, 4, 5].map((stars) => (
                  <button key={stars} className={`chip ${filter.minStars === stars ? 'chip-active' : ''}`} onClick={() => update({ minStars: stars })}>
                    {stars === 0 ? 'Egal' : `${stars} ★`}
                  </button>
                ))}
              </div>
            </div>
            {(tags ?? []).length > 0 && (
              <div>
                <span className="label">Tags</span>
                <div className="flex flex-wrap gap-2">
                  {tags!.map((tag) => {
                    const active = filter.tagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        className={`chip ${active ? 'chip-active' : ''}`}
                        aria-pressed={active}
                        onClick={() =>
                          update({ tagIds: active ? filter.tagIds.filter((id) => id !== tag.id) : [...filter.tagIds, tag.id] })
                        }
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--primary)]"
                checked={filter.notCooked}
                onChange={(event) => update({ notCooked: event.target.checked })}
              />
              Noch nicht gekocht
            </label>
            {extraFilters > 0 && (
              <button className="font-semibold text-primary" onClick={() => setFilter({ ...EMPTY_FILTER, search: filter.search, categoryId: filter.categoryId })}>
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3">
            <ErrorBox message={error} onRetry={() => void refresh()} />
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : (recipes ?? []).length === 0 ? (
          <EmptyState icon={BookOpen} title="Noch keine Rezepte" text="Sammelt hier alles, was ihr mal kochen wollt.">
            <Link to="/rezepte/neu" className="btn btn-soft">
              Von Hand anlegen
            </Link>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="Nichts gefunden" text="Probiere es mit weniger Filtern." />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const imageUrl = useImageUrl(recipe.image_path)
  const average = averageRating(recipe)

  return (
    <Link to={`/rezepte/${recipe.id}`} className="card fade-in flex flex-col overflow-hidden">
      <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-muted">
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageOff size={24} aria-hidden />}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h2 className="line-clamp-2 font-semibold leading-snug">{recipe.title}</h2>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1 text-xs text-muted">
          {average !== null ? <StarsDisplay value={average} size={13} /> : <span>Noch nicht bewertet</span>}
          {recipe.total_minutes !== null && (
            <span className="flex shrink-0 items-center gap-0.5">
              <Clock size={12} aria-hidden />
              {recipe.total_minutes}′
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
