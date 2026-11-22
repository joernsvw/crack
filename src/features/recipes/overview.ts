import type { Recipe } from '../../lib/types'
import { RHYTHM_DAYS } from './rating'

const DAY_MS = 24 * 60 * 60 * 1000
/** Erst wenn der Wunschabstand deutlich ueberschritten ist, gilt ein Gericht als ueberfaellig. */
const OVERDUE_FACTOR = 1.5

export type OverviewTab = 'cooked' | 'saved'
export type OverviewSort = 'rating' | 'recent' | 'name'

export function lastCooked(recipe: Recipe): string | null {
  return recipe.cook_history.reduce<string | null>((latest, entry) => (!latest || entry.cooked_at > latest ? entry.cooked_at : latest), null)
}

/** Tage seit dem letzten Kochen ueber dem Wunschabstand, oder null wenn alles im Rahmen ist. */
export function overdueDays(recipe: Recipe, now = Date.now()): number | null {
  const last = lastCooked(recipe)
  const rhythm = recipe.rating ? RHYTHM_DAYS[recipe.rating] : undefined
  if (!last || !rhythm) return null
  const days = Math.floor((now - new Date(last).getTime()) / DAY_MS)
  return days > rhythm * OVERDUE_FACTOR ? days - rhythm : null
}

export interface DueRecipe {
  recipe: Recipe
  /** Wie weit der Wunschabstand ausgeschoepft ist: 1 = genau faellig, 2 = doppelt so lange her. */
  dueRatio: number
  daysSince: number | null
}

/**
 * Eigene Gerichte, die mal wieder dran waeren: hohe Bewertung und lange nicht gekocht zuerst.
 * Gut bewertete, aber noch nie gekochte Rezepte zaehlen als gerade faellig.
 */
export function dueRecipes(recipes: Recipe[], now = Date.now(), limit = 5): DueRecipe[] {
  return recipes
    .filter((recipe) => recipe.rating !== null && recipe.rating > 0 && !recipe.wheel_hidden)
    .map((recipe) => {
      const last = lastCooked(recipe)
      const daysSince = last ? Math.floor((now - new Date(last).getTime()) / DAY_MS) : null
      const rhythm = RHYTHM_DAYS[recipe.rating!]
      return { recipe, daysSince, dueRatio: daysSince === null ? 1 : daysSince / rhythm }
    })
    .filter((entry) => entry.dueRatio >= 0.8)
    .sort((a, b) => b.dueRatio - a.dueRatio || (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0))
    .slice(0, limit)
}

export function overviewList(
  recipes: Recipe[],
  options: { tab: OverviewTab; sort: OverviewSort; search: string },
): Recipe[] {
  const term = options.search.trim().toLowerCase()
  const byName = (a: Recipe, b: Recipe) => a.title.localeCompare(b.title, 'de')
  const compare: Record<OverviewSort, (a: Recipe, b: Recipe) => number> = {
    // Unbewertete ans Ende, "Nie wieder" (0) davor.
    rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || byName(a, b),
    recent: (a, b) => (lastCooked(b) ?? '').localeCompare(lastCooked(a) ?? '') || byName(a, b),
    name: byName,
  }
  return recipes
    .filter((recipe) => (options.tab === 'cooked' ? recipe.cook_history.length > 0 : recipe.cook_history.length === 0))
    .filter((recipe) => !term || recipe.title.toLowerCase().includes(term))
    .sort(compare[options.sort])
}

/** Ein gewaehltes Tagesdatum wird mittags gespeichert, damit es in keiner Zeitzone auf den Vortag rutscht. */
export function cookedAtFromDate(date: string): string {
  return new Date(`${date}T12:00:00`).toISOString()
}

export function todayInputValue(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
