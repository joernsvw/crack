import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronDown, EyeOff, RotateCw, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useHousehold } from '../../context/HouseholdContext'
import { readCache, writeCache } from '../../lib/cache'
import { supabase } from '../../lib/supabase'
import type { Recipe } from '../../lib/types'
import { AddToShoppingSheet } from './AddToShoppingSheet'
import { useCategories, useRecipes, useTags } from './data'
import {
  buildWheel,
  matchesWheelFilter,
  pickEntry,
  RECENT_DAYS,
  spinRotation,
  truncateLabel,
  type RecentMode,
  type WheelEntry,
} from './wheel'

const PREFS_KEY = 'wheel-prefs'
const SPIN_MS = 4200
const TIME_OPTIONS = [null, 15, 30, 45, 60]
const RECENT_OPTIONS: { value: RecentMode; label: string }[] = [
  { value: 'exclude', label: 'Auslassen' },
  { value: 'lower', label: 'Seltener' },
  { value: 'ignore', label: 'Egal' },
]
const SEGMENT_COLORS = ['var(--primary)', 'var(--primary-soft)', 'var(--star)']
// Die Sternfarbe ist in beiden Modi hell genug fuer dunkle Schrift.
const SEGMENT_TEXT = ['var(--primary-ink)', 'var(--primary-soft-ink)', '#1f2a22']

interface Prefs {
  // undefined: noch nichts gewaehlt, dann gilt Abendessen. null: bewusst alle Kategorien.
  categoryId?: string | null
  maxMinutes: number | null
  tagIds: string[]
  recent: RecentMode
}

const DEFAULT_PREFS: Prefs = { maxMinutes: null, tagIds: [], recent: 'exclude' }

export function WheelPage() {
  const { householdId } = useHousehold()
  const { user } = useAuth()
  const { data: recipes, loading, setData, refresh } = useRecipes(householdId)
  const { data: categories } = useCategories(householdId)
  const { data: tags } = useTags(householdId)
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...readCache<Prefs>(PREFS_KEY) }))
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<Recipe | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const [addedCount, setAddedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    writeCache(PREFS_KEY, next)
    setWinner(null)
    setAddedCount(null)
  }

  const defaultCategory = categories?.find((category) => category.name === 'Abendessen')?.id ?? null
  const categoryId = prefs.categoryId === undefined ? defaultCategory : prefs.categoryId
  const filter = useMemo(
    () => ({ categoryId, maxMinutes: prefs.maxMinutes, tagIds: prefs.tagIds, recent: prefs.recent }),
    [categoryId, prefs.maxMinutes, prefs.tagIds, prefs.recent],
  )

  const entries = useMemo(() => buildWheel(recipes ?? [], filter), [recipes, filter])
  const matching = useMemo(
    () =>
      (recipes ?? [])
        .filter((recipe) => matchesWheelFilter(recipe, filter))
        .sort((a, b) => a.title.localeCompare(b.title, 'de')),
    [recipes, filter],
  )
  const hiddenCount = matching.filter((recipe) => recipe.wheel_hidden).length

  const spin = () => {
    if (spinning || entries.length === 0) return
    const chosen = entries[pickEntry(entries)]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setWinner(null)
    setAddedCount(null)
    setSpinning(true)
    setRotation((current) => spinRotation(current, chosen))
    timer.current = setTimeout(() => {
      setSpinning(false)
      setWinner(chosen.recipe)
    }, reduceMotion ? 200 : SPIN_MS)
  }

  const setHidden = async (recipe: Recipe, hidden: boolean) => {
    setError(null)
    if (winner?.id === recipe.id && hidden) setWinner(null)
    setData((current) => current?.map((entry) => (entry.id === recipe.id ? { ...entry, wheel_hidden: hidden } : entry)) ?? null)
    const { error: updateError } = await supabase.from('recipes').update({ wheel_hidden: hidden }).eq('id', recipe.id)
    if (updateError) {
      setError(navigator.onLine ? updateError.message : 'Dafür brauchst du eine Internetverbindung.')
      await refresh()
    }
  }

  if (loading && !recipes) {
    return (
      <>
        <PageHeader title="Was essen wir heute?" back="/rezepte" />
        <Spinner />
      </>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title="Was essen wir heute?" back="/rezepte" />
      <main className="mx-auto max-w-2xl space-y-5 px-4">
        <div>
          <span className="label">Kategorie</span>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            <button className={`chip ${categoryId === null ? 'chip-active' : ''}`} disabled={spinning} onClick={() => update({ categoryId: null })}>
              Alle
            </button>
            {(categories ?? []).map((category) => (
              <button
                key={category.id}
                className={`chip ${categoryId === category.id ? 'chip-active' : ''}`}
                disabled={spinning}
                onClick={() => update({ categoryId: category.id })}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {entries.length > 0 ? (
          <>
            <Wheel entries={entries} rotation={rotation} spinning={spinning} />
            <button className="btn btn-primary w-full text-lg" disabled={spinning} onClick={spin}>
              <RotateCw size={20} aria-hidden className={spinning ? 'animate-spin' : ''} />
              {spinning ? 'Dreht …' : winner ? 'Nochmal drehen' : 'Drehen'}
            </button>
          </>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Nichts auf dem Rad"
            text={
              matching.length > 0
                ? 'Alle passenden Rezepte sind ausgeblendet oder wurden gerade erst gekocht. Ändere die Auswahl unten.'
                : 'Zu dieser Auswahl gibt es noch keine Rezepte.'
            }
          />
        )}

        <div role="status">
          {winner && (
            <section className="card fade-in p-4 text-center">
              <p className="text-sm text-muted">Heute gibt es:</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">{winner.title}</h2>
              <div className="mt-3 grid gap-2">
                <Link to={`/rezepte/${winner.id}`} className="btn btn-primary">
                  <BookOpen size={18} aria-hidden /> Rezept öffnen
                </Link>
                {winner.recipe_ingredients.length > 0 && (
                  <button className="btn btn-soft" onClick={() => setShoppingOpen(true)}>
                    <ShoppingCart size={18} aria-hidden /> Zutaten auf die Einkaufsliste
                  </button>
                )}
                <button className="btn text-muted" onClick={() => void setHidden(winner, true)}>
                  <EyeOff size={18} aria-hidden /> Nicht mehr im Rad zeigen
                </button>
              </div>
              {addedCount !== null && (
                <p className="fade-in mt-2 rounded-xl bg-primary-soft p-3 text-sm text-primary-soft-ink">
                  {addedCount === 1 ? '1 Zutat' : `${addedCount} Zutaten`} auf der Liste.{' '}
                  <Link to="/einkauf" className="font-semibold underline">
                    Zur Einkaufsliste
                  </Link>
                </p>
              )}
            </section>
          )}
        </div>
        {error && <ErrorBox message={error} />}

        <details className="card" open={showHidden} onToggle={(event) => setShowHidden(event.currentTarget.open)}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold">
            <span>
              Rezepte ausblenden
              {hiddenCount > 0 && <span className="ml-2 text-sm font-normal text-muted">{hiddenCount} ausgeblendet</span>}
            </span>
            <ChevronDown size={18} aria-hidden className={`shrink-0 transition-transform ${showHidden ? 'rotate-180' : ''}`} />
          </summary>
          {matching.length === 0 ? (
            <p className="px-4 pb-3 text-sm text-muted">Zu dieser Auswahl gibt es keine Rezepte.</p>
          ) : (
            <>
              <p className="px-4 pb-1 text-sm text-muted">Ohne Häkchen kommt das Rezept nicht aufs Rad. Das gilt für euch beide.</p>
              <ul className="divide-y divide-line">
                {matching.map((recipe) => (
                  <li key={recipe.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-[var(--primary)]"
                        checked={!recipe.wheel_hidden}
                        disabled={spinning}
                        onChange={(event) => void setHidden(recipe, !event.target.checked)}
                      />
                      <span className={`min-w-0 flex-1 break-words ${recipe.wheel_hidden ? 'text-muted line-through' : ''}`}>{recipe.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>

        <div>
          <span className="label">Höchstens</span>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((minutes) => (
              <button
                key={minutes ?? 'egal'}
                className={`chip ${prefs.maxMinutes === minutes ? 'chip-active' : ''}`}
                disabled={spinning}
                onClick={() => update({ maxMinutes: minutes })}
              >
                {minutes === null ? 'Egal' : `${minutes} Min.`}
              </button>
            ))}
          </div>
          {prefs.maxMinutes !== null && <p className="mt-1 text-xs text-muted">Rezepte ohne Zeitangabe sind dann nicht dabei.</p>}
        </div>

        <div>
          <span className="label">In den letzten {RECENT_DAYS} Tagen Gekochtes</span>
          <div className="flex flex-wrap gap-2">
            {RECENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`chip ${prefs.recent === option.value ? 'chip-active' : ''}`}
                disabled={spinning}
                onClick={() => update({ recent: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {(tags ?? []).length > 0 && (
          <div>
            <span className="label">Nur mit Tag</span>
            <div className="flex flex-wrap gap-2">
              {tags!.map((tag) => {
                const active = prefs.tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    className={`chip ${active ? 'chip-active' : ''}`}
                    aria-pressed={active}
                    disabled={spinning}
                    onClick={() => update({ tagIds: active ? prefs.tagIds.filter((id) => id !== tag.id) : [...prefs.tagIds, tag.id] })}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {shoppingOpen && winner && (
        <AddToShoppingSheet
          householdId={householdId}
          userId={user!.id}
          ingredients={winner.recipe_ingredients}
          onClose={() => setShoppingOpen(false)}
          onAdded={(count) => {
            setShoppingOpen(false)
            setAddedCount(count)
          }}
        />
      )}
    </div>
  )
}

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = SIZE / 2 - 4

function point(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return `${CENTER + radius * Math.cos(radians)} ${CENTER + radius * Math.sin(radians)}`
}

function Wheel({ entries, rotation, spinning }: { entries: WheelEntry[]; rotation: number; spinning: boolean }) {
  // Der letzte Abschnitt darf nicht dieselbe Farbe wie der erste haben, sonst verschmelzen sie.
  const colorIndex = (index: number) =>
    index === entries.length - 1 && entries.length % SEGMENT_COLORS.length === 1 ? 1 : index % SEGMENT_COLORS.length

  return (
    <div className="relative mx-auto w-full max-w-xs" aria-hidden>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            // In Pixeln statt "center": Safari rechnet das bei SVG-Gruppen sonst anders.
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.15, 1)` : 'none',
          }}
        >
          {entries.map((entry, index) => {
            const width = entry.endAngle - entry.startAngle
            const color = colorIndex(index)
            const middle = entry.startAngle + width / 2
            return (
              <g key={entry.recipe.id}>
                {entries.length === 1 ? (
                  <circle cx={CENTER} cy={CENTER} r={RADIUS} fill={SEGMENT_COLORS[0]} />
                ) : (
                  <path
                    d={`M ${CENTER} ${CENTER} L ${point(entry.startAngle, RADIUS)} A ${RADIUS} ${RADIUS} 0 ${width > 180 ? 1 : 0} 1 ${point(entry.endAngle, RADIUS)} Z`}
                    fill={SEGMENT_COLORS[color]}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                )}
                {width >= 9 && (
                  <text
                    transform={`rotate(${middle - 90} ${CENTER} ${CENTER})`}
                    x={CENTER + RADIUS - 12}
                    y={CENTER}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={width >= 22 ? 14 : 11}
                    fontWeight="600"
                    fill={SEGMENT_TEXT[entries.length === 1 ? 0 : color]}
                  >
                    {truncateLabel(entry.recipe.title)}
                  </text>
                )}
              </g>
            )
          })}
        </g>
        <circle cx={CENTER} cy={CENTER} r="14" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      </svg>
      <div
        className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2"
        style={{ borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '20px solid var(--danger)' }}
      />
    </div>
  )
}
