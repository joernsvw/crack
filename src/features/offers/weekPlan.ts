import type { Offer, Recipe, Suggestion } from '../../lib/types'
import { RHYTHM_DAYS } from '../recipes/rating'
import { lastCooked } from '../recipes/overview'
import { findOffers, scanRecipes } from './match'

const DAY_MS = 24 * 60 * 60 * 1000

export type PlanEntry =
  | { kind: 'recipe'; recipe: Recipe; offerCount: number; reasons: string[] }
  | { kind: 'idea'; suggestion: Suggestion; offerCount: number; reasons: string[] }

/**
 * Ein erster Versuch fuer einen Wochenplan, ganz ohne KI: Lieblingsgerichte mit Zutaten im Angebot zuerst,
 * dazu Faelliges und hoechstens eine neue Idee aus den gespeicherten Vorschlaegen.
 */
export function weekPlan(
  recipes: Recipe[],
  offers: Offer[],
  suggestions: Suggestion[],
  options: { days?: number; now?: number; skip?: string[] } = {},
): PlanEntry[] {
  const days = options.days ?? 5
  const now = options.now ?? Date.now()
  const skip = new Set(options.skip ?? [])
  const offerCounts = new Map(scanRecipes(recipes, offers).map((scan) => [scan.recipe.id, scan.matches.length]))

  const ranked = recipes
    .filter((recipe) => recipe.rating !== null && recipe.rating >= 3 && !recipe.wheel_hidden && !skip.has(recipe.id))
    .map((recipe) => {
      const last = lastCooked(recipe)
      const due = last ? (now - new Date(last).getTime()) / DAY_MS / RHYTHM_DAYS[recipe.rating!] : 1
      // Gerade erst gekocht? Dann lieber nicht schon wieder.
      if (due < 0.5) return null
      const offerCount = offerCounts.get(recipe.id) ?? 0
      const reasons = [
        offerCount > 0 && `${offerCount === 1 ? '1 Zutat' : `${offerCount} Zutaten`} im Angebot`,
        recipe.rating! >= 4 && 'Lieblingsgericht',
        due >= 1 && 'Mal wieder fällig',
      ].filter((reason): reason is string => Boolean(reason))
      return { recipe, offerCount, reasons, score: offerCount * 2 + recipe.rating! + Math.min(due, 2) }
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title, 'de'))

  // Bei nur ein oder zwei Kochtagen lieber Bewaehrtes statt Experimente.
  const ideas = (days < 3 ? [] : suggestions)
    .filter((suggestion) => !skip.has(suggestion.name))
    .map((suggestion) => ({
      suggestion,
      offerCount: suggestion.main_ingredients.filter((ingredient) => findOffers(ingredient, offers).length > 0).length,
    }))
    .sort((a, b) => b.offerCount - a.offerCount)

  const plan: PlanEntry[] = ranked
    .slice(0, ideas.length > 0 ? days - 1 : days)
    .map(({ recipe, offerCount, reasons }) => ({ kind: 'recipe', recipe, offerCount, reasons }))
  const idea = ideas[0]
  if (idea && plan.length < days) {
    plan.push({
      kind: 'idea',
      suggestion: idea.suggestion,
      offerCount: idea.offerCount,
      reasons: ['Neue Idee', ...(idea.offerCount > 0 ? [`${idea.offerCount === 1 ? '1 Zutat' : `${idea.offerCount} Zutaten`} im Angebot`] : [])],
    })
  }
  // Reicht es nicht fuer jeden Tag, mit weiteren eigenen Gerichten auffuellen.
  for (const entry of ranked) {
    if (plan.length >= days) break
    if (!plan.some((planned) => planned.kind === 'recipe' && planned.recipe.id === entry.recipe.id)) {
      plan.push({ kind: 'recipe', recipe: entry.recipe, offerCount: entry.offerCount, reasons: entry.reasons })
    }
  }
  return plan
}
