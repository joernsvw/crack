import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useHousehold } from '../../context/HouseholdContext'
import { isSafeUrl } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Recipe } from '../../lib/types'
import { BUCKET, compressImage, saveRecipe, uploadRecipeImage, useCategories, useImageUrl, useRecipes, useTags } from './data'
import type { ImportedDraft } from './importLink'

interface IngredientRow {
  key: string
  quantity: string
  unit: string
  name: string
}

const newRow = (): IngredientRow => ({ key: crypto.randomUUID(), quantity: '', unit: '', name: '' })

export function RecipeFormPage() {
  const { id } = useParams()
  const { householdId } = useHousehold()
  const { data: recipes, loading } = useRecipes(householdId)
  const existing = id ? recipes?.find((recipe) => recipe.id === id) : null
  const draft = (useLocation().state as { draft?: ImportedDraft } | null)?.draft ?? null

  if (id && !existing) {
    return (
      <>
        <PageHeader title="Rezept bearbeiten" back={true} />
        {loading ? <Spinner /> : <main className="mx-auto max-w-2xl p-4"><ErrorBox message="Dieses Rezept gibt es nicht mehr." /></main>}
      </>
    )
  }
  // key: Das Formular startet erst mit den fertig geladenen Daten.
  return <RecipeForm key={id ?? 'neu'} existing={existing ?? null} draft={draft} />
}

function RecipeForm({ existing, draft }: { existing: Recipe | null; draft: ImportedDraft | null }) {
  const navigate = useNavigate()
  const { householdId } = useHousehold()
  const { data: categories } = useCategories(householdId)
  const { data: allTags } = useTags(householdId)
  const recipeId = useRef(existing?.id ?? crypto.randomUUID()).current
  // Ein KI-Vorschlag hat Vorrang vor dem gespeicherten Stand, gespeichert wird er erst mit "Speichern".
  const initial = draft ?? existing
  const initialIngredients = draft?.ingredients ?? existing?.recipe_ingredients ?? []
  const initialImagePath = initial?.image_path ?? null

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [servings, setServings] = useState(initial?.servings?.toString() ?? '')
  const [minutes, setMinutes] = useState(initial?.total_minutes?.toString() ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '')
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    initialIngredients.length
      ? initialIngredients.map((item) => ({
          key: crypto.randomUUID(),
          quantity: item.quantity ?? '',
          unit: item.unit ?? '',
          name: item.name,
        }))
      : [newRow()],
  )
  const [steps, setSteps] = useState<string[]>(initial?.steps.length ? initial.steps : [''])
  const [tagNames, setTagNames] = useState<string[]>(
    () =>
      draft?.tags ??
      (allTags ?? []).filter((tag) => existing?.recipe_tags.some((link) => link.tag_id === tag.id)).map((tag) => tag.name),
  )
  const [tagInput, setTagInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tags koennen erst nach dem ersten Rendern aus dem Netz kommen.
  const tagsReady = useRef((allTags ?? []).length > 0)
  useEffect(() => {
    if (tagsReady.current || !allTags || !existing || draft) return
    tagsReady.current = true
    setTagNames(allTags.filter((tag) => existing.recipe_tags.some((link) => link.tag_id === tag.id)).map((tag) => tag.name))
  }, [allTags, existing, draft])

  const storedUrl = useImageUrl(removeImage ? null : initialImagePath)
  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile])
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl],
  )
  const shownImage = previewUrl ?? storedUrl

  const suggestions = (allTags ?? []).filter(
    (tag) => !tagNames.includes(tag.name) && tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()),
  )

  const addTag = (raw: string) => {
    const name = raw.trim()
    if (name && !tagNames.some((tag) => tag.toLowerCase() === name.toLowerCase())) setTagNames([...tagNames, name])
    setTagInput('')
  }

  const updateIngredient = (key: string, patch: Partial<IngredientRow>) =>
    setIngredients((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const url = sourceUrl.trim()
    if (url && !isSafeUrl(url)) {
      setError('Der Link muss mit http:// oder https:// beginnen.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let imagePath = removeImage ? null : initialImagePath
      if (imageFile) {
        imagePath = await uploadRecipeImage(householdId, recipeId, await compressImage(imageFile))
      }
      await saveRecipe(
        householdId,
        recipeId,
        {
          title: title.trim(),
          description: description.trim() || null,
          steps: steps.map((step) => step.trim()).filter(Boolean),
          servings: servings ? Number(servings) : null,
          total_minutes: minutes ? Number(minutes) : null,
          category_id: categoryId || null,
          source_url: url || null,
          image_path: imagePath,
          ingredients: ingredients
            .filter((row) => row.name.trim())
            .map((row) => ({ name: row.name.trim(), quantity: row.quantity.trim() || null, unit: row.unit.trim() || null })),
          tagNames: tagInput.trim() ? [...tagNames, tagInput.trim()] : tagNames,
        },
        existing,
      )
      if (initialImagePath && initialImagePath !== imagePath) {
        await supabase.storage.from(BUCKET).remove([initialImagePath])
      }
      navigate(`/rezepte/${recipeId}`, { replace: true })
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Zum Speichern brauchst du eine Internetverbindung.')
      setBusy(false)
    }
  }

  return (
    <div className="pb-28">
      <PageHeader title={existing ? 'Rezept bearbeiten' : 'Neues Rezept'} back={true} />
      <form id="recipe-form" className="mx-auto max-w-2xl space-y-5 px-4 pt-1" onSubmit={submit}>
        {draft && (
          <p className="rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink" role="status">
            {existing
              ? 'Vorschlag der KI. Noch ist nichts gespeichert: Prüfe die Änderungen und tippe auf Speichern.'
              : draft.ingredients.length > 0
                ? 'Entwurf erstellt. Prüfe kurz alles und tippe dann auf Speichern.'
                : 'In diesem Link standen keine Zutaten, zum Beispiel weil sie nur im Video vorkommen. Speichere das Rezept und füge danach einen Screenshot der Zutaten hinzu.'}
          </p>
        )}
        <div>
          <label className="label" htmlFor="title">
            Titel
          </label>
          <input id="title" className="input" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div>
          <span className="label">Bild</span>
          {shownImage ? (
            <div className="relative">
              <img src={shownImage} alt="Vorschau" className="aspect-video w-full rounded-xl object-cover" />
              <button
                type="button"
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Bild entfernen"
                onClick={() => {
                  setImageFile(null)
                  setRemoveImage(true)
                }}
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-muted">
              <ImagePlus size={24} aria-hidden />
              Foto hinzufügen
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  setImageFile(event.target.files?.[0] ?? null)
                  setRemoveImage(false)
                }}
              />
            </label>
          )}
        </div>

        <div>
          <label className="label" htmlFor="category">
            Kategorie
          </label>
          <select id="category" className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Keine Kategorie</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="servings">
              Portionen
            </label>
            <input id="servings" className="input" type="number" inputMode="numeric" min={1} value={servings} onChange={(event) => setServings(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="minutes">
              Zeit (Minuten)
            </label>
            <input id="minutes" className="input" type="number" inputMode="numeric" min={0} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
          </div>
        </div>

        <div>
          <span className="label">Zutaten</span>
          <div className="space-y-2">
            {ingredients.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <input className="input !w-16 shrink-0 !px-2" placeholder="Menge" aria-label="Menge" value={row.quantity} onChange={(event) => updateIngredient(row.key, { quantity: event.target.value })} />
                <input className="input !w-16 shrink-0 !px-2" placeholder="Einh." aria-label="Einheit" value={row.unit} onChange={(event) => updateIngredient(row.key, { unit: event.target.value })} />
                <input className="input min-w-0" placeholder="Zutat" aria-label="Zutat" value={row.name} onChange={(event) => updateIngredient(row.key, { name: event.target.value })} />
                <button
                  type="button"
                  className="icon-btn !w-8"
                  aria-label="Zutat entfernen"
                  onClick={() => setIngredients((rows) => (rows.length > 1 ? rows.filter((other) => other.key !== row.key) : [newRow()]))}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-soft mt-2 w-full" onClick={() => setIngredients([...ingredients, newRow()])}>
            <Plus size={18} /> Zutat
          </button>
        </div>

        <div>
          <span className="label">Zubereitung</span>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="flex h-11 w-5 shrink-0 items-center justify-center text-sm font-semibold text-muted">{index + 1}</span>
                <textarea
                  className="input"
                  rows={2}
                  aria-label={`Schritt ${index + 1}`}
                  value={step}
                  onChange={(event) => setSteps(steps.map((other, position) => (position === index ? event.target.value : other)))}
                />
                <button
                  type="button"
                  className="icon-btn !w-8"
                  aria-label={`Schritt ${index + 1} entfernen`}
                  onClick={() => setSteps(steps.length > 1 ? steps.filter((_, position) => position !== index) : [''])}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-soft mt-2 w-full" onClick={() => setSteps([...steps, ''])}>
            <Plus size={18} /> Schritt
          </button>
        </div>

        <div>
          <label className="label" htmlFor="tag-input">
            Tags
          </label>
          {tagNames.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {tagNames.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip chip-active"
                  aria-label={`Tag ${tag} entfernen`}
                  onClick={() => setTagNames(tagNames.filter((other) => other !== tag))}
                >
                  {tag} <X size={14} aria-hidden />
                </button>
              ))}
            </div>
          )}
          <input
            id="tag-input"
            className="input"
            placeholder="z. B. schnell, vegetarisch"
            maxLength={40}
            enterKeyHint="done"
            value={tagInput}
            onChange={(event) => {
              const value = event.target.value
              if (value.endsWith(',')) addTag(value.slice(0, -1))
              else setTagInput(value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addTag(tagInput)
              }
            }}
          />
          {suggestions.length > 0 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {suggestions.map((tag) => (
                <button key={tag.id} type="button" className="chip" onClick={() => addTag(tag.name)}>
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="description">
            Beschreibung
          </label>
          <textarea id="description" className="input" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="source">
            Link zum Original
          </label>
          <input id="source" className="input" type="url" inputMode="url" autoCapitalize="none" placeholder="https://" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
        </div>

        {error && <ErrorBox message={error} />}
      </form>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-2xl p-3">
          <button form="recipe-form" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
