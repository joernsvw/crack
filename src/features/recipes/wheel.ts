import type { Recipe } from '../../lib/types'

export type RecentMode = 'exclude' | 'lower' | 'ignore'

export const RECENT_DAYS = 7
const UNRATED_STARS = 3
const RECENT_FACTOR = 0.25
const DAY_MS = 24 * 60 * 60 * 1000

export interface WheelFilter {
  categoryId: string | null
  maxMinutes: number | null
  tagIds: string[]
  recent: RecentMode
}

function cookedRecently(recipe: Recipe, now: number): boolean {
  return recipe.cook_history.some((entry) => now - new Date(entry.cooked_at).getTime() < RECENT_DAYS * DAY_MS)
}

/** Passt zu Kategorie, Zeit und Tags. Ausgeblendete Rezepte zaehlen hier mit, damit man sie wieder einblenden kann. */
export function matchesWheelFilter(recipe: Recipe, filter: WheelFilter): boolean {
  if (filter.categoryId && recipe.category_id !== filter.categoryId) return false
  if (filter.maxMinutes !== null && (recipe.total_minutes === null || recipe.total_minutes > filter.maxMinutes)) return false
  const own = new Set(recipe.recipe_tags.map((link) => link.tag_id))
  return filter.tagIds.every((id) => own.has(id))
}

/** Sterne zum Quadrat: 5 Sterne kommen viel oefter als 2. Unbewertete liegen im Mittelfeld. */
export function wheelWeight(recipe: Recipe, recent: RecentMode, now = Date.now()): number {
  const stars = recipe.recipe_ratings.map((rating) => rating.stars)
  const average = stars.length ? stars.reduce((sum, value) => sum + value, 0) / stars.length : UNRATED_STARS
  const base = average * average
  return recent === 'lower' && cookedRecently(recipe, now) ? base * RECENT_FACTOR : base
}

export interface WheelEntry {
  recipe: Recipe
  weight: number
  startAngle: number
  endAngle: number
}

/** Was tatsaechlich auf dem Rad landet. Die Groesse jedes Felds entspricht seiner Chance. */
export function buildWheel(recipes: Recipe[], filter: WheelFilter, now = Date.now()): WheelEntry[] {
  const candidates = recipes
    .filter((recipe) => matchesWheelFilter(recipe, filter) && !recipe.wheel_hidden)
    .filter((recipe) => filter.recent !== 'exclude' || !cookedRecently(recipe, now))
    .map((recipe) => ({ recipe, weight: wheelWeight(recipe, filter.recent, now) }))
  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0)
  let angle = 0
  return candidates.map((entry) => {
    const startAngle = angle
    angle += (entry.weight / total) * 360
    return { ...entry, startAngle, endAngle: angle }
  })
}

/** Gewichtete Zufallsauswahl. random ist austauschbar, damit sich das testen laesst. */
export function pickEntry(entries: WheelEntry[], random: () => number = Math.random): number {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
  let point = random() * total
  for (let index = 0; index < entries.length; index++) {
    point -= entries[index].weight
    if (point < 0) return index
  }
  return entries.length - 1
}

/** Neuer Drehwinkel, bei dem der Zeiger oben in das gewaehlte Feld zeigt, nicht genau auf dessen Rand. */
export function spinRotation(current: number, entry: Pick<WheelEntry, 'startAngle' | 'endAngle'>, random: () => number = Math.random, turns = 5): number {
  const width = entry.endAngle - entry.startAngle
  const target = entry.startAngle + width * (0.15 + random() * 0.7)
  const needed = ((360 - target - current) % 360 + 360) % 360
  return current + turns * 360 + needed
}

/** Der Punkt des Rads, auf den der Zeiger oben gerade zeigt. */
export function pointerAngle(rotation: number): number {
  return ((360 - rotation) % 360 + 360) % 360
}

export function truncateLabel(text: string, max = 18): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
