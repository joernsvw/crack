import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle2, Clock, ExternalLink, Pencil, ShoppingCart, Trash2, Undo2, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useHousehold } from '../../context/HouseholdContext'
import { formatRelativeDate, isSafeUrl } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Modification, Recipe } from '../../lib/types'
import { AddToShoppingSheet } from './AddToShoppingSheet'
import { BUCKET, useCategories, useImageUrl, useRecipes, useTags } from './data'
import { RecipeAiEdit } from './RecipeAiEdit'
import { StarsInput } from './Stars'

export function RecipeDetailPage() {
  const { id } = useParams()
  const { householdId } = useHousehold()
  const { data: recipes, loading, refresh } = useRecipes(householdId)
  const recipe = recipes?.find((candidate) => candidate.id === id)

  if (!recipe) {
    return (
      <>
        <PageHeader title="Rezept" back="/rezepte" />
        {loading ? <Spinner /> : <EmptyState icon={BookOpen} title="Dieses Rezept gibt es nicht mehr" />}
      </>
    )
  }
  return <RecipeDetail recipe={recipe} refresh={refresh} />
}

function RecipeDetail({ recipe, refresh }: { recipe: Recipe; refresh: () => Promise<void> }) {
  const { householdId } = useHousehold()
  const navigate = useNavigate()
  const imageUrl = useImageUrl(recipe.image_path)
  const { data: categories } = useCategories(householdId)
  const { data: tags } = useTags(householdId)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [addedCount, setAddedCount] = useState<number | null>(null)

  const category = categories?.find((candidate) => candidate.id === recipe.category_id)
  const recipeTags = (tags ?? []).filter((tag) => recipe.recipe_tags.some((link) => link.tag_id === tag.id))
  const cookCount = recipe.cook_history.length

  const run = async (action: PromiseLike<{ error: { message: string } | null }>) => {
    setError(null)
    const { error: actionError } = await action
    if (actionError) {
      setError(navigator.onLine ? actionError.message : 'Dafür brauchst du eine Internetverbindung.')
      return false
    }
    await refresh()
    return true
  }

  const remove = async () => {
    if (!window.confirm(`„${recipe.title}“ wirklich löschen?`)) return
    setError(null)
    const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipe.id)
    if (deleteError) {
      setError(navigator.onLine ? deleteError.message : 'Dafür brauchst du eine Internetverbindung.')
      return
    }
    if (recipe.image_path) await supabase.storage.from(BUCKET).remove([recipe.image_path])
    navigate('/rezepte', { replace: true })
  }

  return (
    <div className="pb-10">
      <PageHeader
        title={recipe.title}
        back="/rezepte"
        actions={
          <>
            <Link to={`/rezepte/${recipe.id}/bearbeiten`} className="icon-btn" aria-label="Rezept bearbeiten">
              <Pencil size={20} />
            </Link>
            <button className="icon-btn" aria-label="Rezept löschen" onClick={() => void remove()}>
              <Trash2 size={20} />
            </button>
          </>
        }
      />
      <main className="mx-auto max-w-2xl space-y-6 px-4">
        {imageUrl && <img src={imageUrl} alt="" className="aspect-video w-full rounded-2xl object-cover" />}

        <section>
          <h1 className="text-2xl font-bold leading-tight">{recipe.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {category && <span>{category.name}</span>}
            {recipe.total_minutes !== null && (
              <span className="flex items-center gap-1">
                <Clock size={14} aria-hidden /> {recipe.total_minutes} Min.
              </span>
            )}
            {recipe.servings !== null && (
              <span className="flex items-center gap-1">
                <Users size={14} aria-hidden /> {recipe.servings} {recipe.servings === 1 ? 'Portion' : 'Portionen'}
              </span>
            )}
          </div>
          {recipeTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipeTags.map((tag) => (
                <span key={tag.id} className="chip !min-h-7 text-xs">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {recipe.description && <p className="mt-3 whitespace-pre-wrap">{recipe.description}</p>}
          {isSafeUrl(recipe.source_url) && (
            <a href={recipe.source_url!} target="_blank" rel="noopener noreferrer" className="btn btn-soft mt-3">
              <ExternalLink size={18} /> Original öffnen
            </a>
          )}
        </section>

        {error && <ErrorBox message={error} />}

        <RecipeAiEdit recipeId={recipe.id} />

        <section className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{cookCount > 0 ? 'Schon gekocht' : 'Noch nicht ausprobiert'}</p>
              {cookCount > 0 && (
                <p className="text-sm text-muted">
                  {cookCount}× · zuletzt {formatRelativeDate(recipe.cook_history[0].cooked_at, false)}
                </p>
              )}
            </div>
            {cookCount > 0 && (
              <button
                className="icon-btn"
                aria-label="Letztes Kochen zurücknehmen"
                onClick={() => void run(supabase.from('cook_history').delete().eq('id', recipe.cook_history[0].id))}
              >
                <Undo2 size={20} />
              </button>
            )}
          </div>
          <button
            className="btn btn-primary mt-3 w-full"
            onClick={() => void run(supabase.from('cook_history').insert({ household_id: householdId, recipe_id: recipe.id }))}
          >
            <CheckCircle2 size={20} /> Heute gekocht
          </button>
        </section>

        <RatingSection recipe={recipe} run={run} />

        <section>
          <h2 className="mb-2 text-lg font-bold">Zutaten</h2>
          {recipe.recipe_ingredients.length === 0 ? (
            <p className="text-muted">
              Noch keine Zutaten eingetragen. Füge oben unter „Mit KI anpassen“ einen Screenshot hinzu oder{' '}
              <Link to={`/rezepte/${recipe.id}/bearbeiten`} className="font-semibold text-primary">
                trage sie von Hand ein
              </Link>
              .
            </p>
          ) : (
            <>
              <ul className="card divide-y divide-line">
                {recipe.recipe_ingredients.map((ingredient) => (
                  <li key={ingredient.id} className="flex justify-between gap-3 px-4 py-2.5">
                    <span>{ingredient.name}</span>
                    <span className="shrink-0 text-right text-muted">
                      {[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')}
                      {ingredient.metric && <span className="block text-sm font-medium text-primary-soft-ink">{ingredient.metric}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-soft mt-2 w-full"
                onClick={() => {
                  setAddedCount(null)
                  setShoppingOpen(true)
                }}
              >
                <ShoppingCart size={18} aria-hidden /> Zutaten auf die Einkaufsliste
              </button>
              {addedCount !== null && (
                <p className="fade-in mt-2 rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
                  {addedCount === 1 ? '1 Zutat' : `${addedCount} Zutaten`} auf der Liste.{' '}
                  <Link to="/einkauf" className="font-semibold underline">
                    Zur Einkaufsliste
                  </Link>
                </p>
              )}
              {shoppingOpen && (
                <AddToShoppingSheet
                  householdId={householdId}
                  userId={user!.id}
                  ingredients={recipe.recipe_ingredients}
                  onClose={() => setShoppingOpen(false)}
                  onAdded={(count) => {
                    setShoppingOpen(false)
                    setAddedCount(count)
                  }}
                />
              )}
            </>
          )}
        </section>

        {recipe.steps.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-bold">Zubereitung</h2>
            <ol className="space-y-3">
              {recipe.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-ink">
                    {index + 1}
                  </span>
                  <p className="min-w-0 flex-1 whitespace-pre-wrap pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  )
}

const MODIFICATION_LABELS: Record<Modification['type'], string> = {
  omitted: 'weggelassen',
  replaced: 'ausgetauscht',
  more: 'mehr davon',
}

/** Was ihr beim Kochen geaendert habt. Fliesst automatisch ins Geschmacksprofil unter Entdecken ein. */
function ModificationEditor({
  recipe,
  run,
}: {
  recipe: Recipe
  run: (action: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>
}) {
  const [items, setItems] = useState<Modification[]>(recipe.modifications ?? [])

  const save = (next: Modification[]) => {
    setItems(next)
    void run(supabase.from('recipes').update({ modifications: next }).eq('id', recipe.id))
  }

  const setType = (ingredient: string, type: Modification['type'] | '') => {
    const others = items.filter((item) => item.ingredient !== ingredient)
    save(type ? [...others, { ingredient, type, replacement: type === 'replaced' ? '' : null }] : others)
  }

  const setReplacement = (ingredient: string, replacement: string) =>
    setItems(items.map((item) => (item.ingredient === ingredient ? { ...item, replacement } : item)))

  return (
    <details className="mt-3 border-t border-line pt-2" open={items.length > 0}>
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">Beim Kochen etwas geändert?</summary>
      <ul className="space-y-2">
        {recipe.recipe_ingredients.map((ingredient) => {
          const current = items.find((item) => item.ingredient === ingredient.name)
          return (
            <li key={ingredient.id ?? ingredient.name}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 break-words text-sm">{ingredient.name}</span>
                <select
                  className="input !w-36 shrink-0 !text-sm"
                  aria-label={`Änderung bei ${ingredient.name}`}
                  value={current?.type ?? ''}
                  onChange={(event) => setType(ingredient.name, event.target.value as Modification['type'] | '')}
                >
                  <option value="">wie im Rezept</option>
                  {Object.entries(MODIFICATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {current?.type === 'replaced' && (
                <input
                  className="input mt-1"
                  placeholder="Ausgetauscht durch …"
                  aria-label={`${ingredient.name} ausgetauscht durch`}
                  value={current.replacement ?? ''}
                  onChange={(event) => setReplacement(ingredient.name, event.target.value)}
                  onBlur={() => save(items)}
                />
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Daraus lernt der Tab Entdecken, was ihr mögt und was nicht.</p>
    </details>
  )
}

function RatingSection({
  recipe,
  run,
}: {
  recipe: Recipe
  run: (action: PromiseLike<{ error: { message: string } | null }>) => Promise<boolean>
}) {
  const [note, setNote] = useState(recipe.rating_note ?? '')

  useEffect(() => {
    setNote(recipe.rating_note ?? '')
  }, [recipe.rating_note])

  const rate = (rating: number | null) => run(supabase.from('recipes').update({ rating }).eq('id', recipe.id))

  const saveNote = () => {
    const trimmed = note.trim() || null
    if (trimmed !== recipe.rating_note) void run(supabase.from('recipes').update({ rating_note: trimmed }).eq('id', recipe.id))
  }

  return (
    <section className="card p-4">
      <h2 className="font-semibold">Wie oft wollt ihr das essen?</h2>
      <div className="mt-1">
        <StarsInput value={recipe.rating} onChange={(rating) => void rate(rating)} />
      </div>
      <textarea
        className="input mt-2"
        rows={2}
        placeholder="Notiz, z. B. „Beim nächsten Mal mehr Knoblauch“"
        aria-label="Notiz zur Bewertung"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={saveNote}
      />
      {recipe.recipe_ingredients.length > 0 && <ModificationEditor recipe={recipe} run={run} />}
    </section>
  )
}
