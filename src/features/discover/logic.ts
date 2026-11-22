import type { Recipe, TasteProfile } from '../../lib/types'

const normalize = (text: string) => text.trim().toLowerCase()

/** "Reibekäse" passt zu "Käse", "Tomate" zu "Tomaten". Sehr kurze Begriffe muessen genau stimmen. */
export function sameIngredient(a: string, b: string): boolean {
  const x = normalize(a)
  const y = normalize(b)
  if (x.length < 3 || y.length < 3) return x === y && x.length > 0
  return x.includes(y) || y.includes(x)
}

/** "Dal Makhani!" wird zu "dalmakhani". Umlaute bleiben, TikTok-Hashtags koennen sie enthalten. */
export function toHashtag(dish: string): string {
  return dish.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Keine erfundenen Direktlinks: Es sind reine Such-Adressen mit dem Gerichtsnamen.
 * Die TikTok-App uebernimmt den Suchbegriff aus dem Link nicht immer. Deshalb wird er beim Antippen
 * zusaetzlich kopiert, und der Hashtag-Link zeigt direkt passende Videos.
 */
export function searchLinks(dish: string) {
  const query = `${dish} Rezept`
  return [
    { label: 'TikTok', url: `https://www.tiktok.com/search/video?q=${encodeURIComponent(query)}`, copy: query },
    { label: 'Pinterest', url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`, copy: query },
    { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, copy: null },
  ]
}

export function tiktokTagLink(dish: string): { label: string; url: string } | null {
  const tag = toHashtag(dish)
  return tag ? { label: `#${tag}`, url: `https://www.tiktok.com/tag/${encodeURIComponent(tag)}` } : null
}

export interface RecipeMatch {
  recipe: Recipe
  matched: string[]
  missing: number
}

/** Eigene Rezepte nach Uebereinstimmung mit den vorhandenen Zutaten, bei Gleichstand gewinnt die bessere Bewertung. */
export function matchRecipes(recipes: Recipe[], available: string[], limit = 6): RecipeMatch[] {
  const score = (recipe: Recipe) => recipe.rating ?? 0
  return recipes
    .filter((recipe) => recipe.rating !== 0)
    .map((recipe) => {
      const matched = recipe.recipe_ingredients
        .filter((ingredient) => available.some((item) => sameIngredient(ingredient.name, item)))
        .map((ingredient) => ingredient.name)
      const total = recipe.recipe_ingredients.length
      return { recipe, matched, missing: total - matched.length, share: total ? matched.length / total : 0 }
    })
    .filter((entry) => entry.matched.length > 0)
    .sort((a, b) => b.share - a.share || score(b.recipe) - score(a.recipe))
    .slice(0, limit)
    .map(({ recipe, matched, missing }) => ({ recipe, matched, missing }))
}

const DEFAULT_CHIPS = ['Eier', 'Zwiebeln', 'Käse', 'Paprika', 'Reis', 'Nudeln', 'Kartoffeln', 'Tomaten', 'Sahne', 'Hackfleisch']

/** Haeufige Zutaten aus den eigenen Rezepten, aufgefuellt mit typischen Resten. */
export function commonIngredients(recipes: Recipe[], limit = 12): string[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const recipe of recipes) {
    for (const { name } of recipe.recipe_ingredients) {
      const key = normalize(name)
      const entry = counts.get(key)
      if (entry) entry.count += 1
      else counts.set(key, { name: name.trim(), count: 1 })
    }
  }
  const frequent = [...counts.values()]
    .filter((entry) => entry.count >= 2 && entry.name.length <= 24)
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.name)
  const result: string[] = []
  for (const name of [...frequent, ...DEFAULT_CHIPS]) {
    if (!result.some((item) => sameIngredient(item, name))) result.push(name)
    if (result.length >= limit) break
  }
  return result
}

export const HINT_THRESHOLD = 3

export interface ProfileHint {
  key: string
  list: 'likes' | 'avoids'
  ingredient: string
  count: number
  text: string
}

/** Wiederholte Anpassungen werden zu Vorschlaegen fuers Profil: 3x Tomaten weggelassen heisst vermutlich "lieber vermeiden". */
export function profileHints(recipes: Recipe[], profile: Pick<TasteProfile, 'likes' | 'avoids' | 'dismissed_hints'>): ProfileHint[] {
  const tally = new Map<string, { ingredient: string; removed: number; more: number }>()
  for (const recipe of recipes) {
    for (const change of recipe.modifications ?? []) {
      const key = normalize(change.ingredient ?? '')
      if (!key) continue
      const entry = tally.get(key) ?? { ingredient: change.ingredient.trim(), removed: 0, more: 0 }
      if (change.type === 'omitted' || change.type === 'replaced') entry.removed += 1
      if (change.type === 'more') entry.more += 1
      tally.set(key, entry)
    }
  }

  const hints: ProfileHint[] = []
  for (const [key, entry] of tally) {
    const listed = (list: string[]) => list.some((item) => sameIngredient(item, entry.ingredient))
    if (entry.removed >= HINT_THRESHOLD && !listed(profile.avoids) && !profile.dismissed_hints.includes(`avoids:${key}`)) {
      hints.push({
        key: `avoids:${key}`,
        list: 'avoids',
        ingredient: entry.ingredient,
        count: entry.removed,
        text: `${entry.ingredient} habt ihr ${entry.removed}× weggelassen oder ersetzt. Zu „Lieber vermeiden“ hinzufügen?`,
      })
    }
    if (entry.more >= HINT_THRESHOLD && !listed(profile.likes) && !profile.dismissed_hints.includes(`likes:${key}`)) {
      hints.push({
        key: `likes:${key}`,
        list: 'likes',
        ingredient: entry.ingredient,
        count: entry.more,
        text: `Von ${entry.ingredient} wolltet ihr ${entry.more}× mehr. Zu „Mögen wir gern“ hinzufügen?`,
      })
    }
  }
  return hints.sort((a, b) => b.count - a.count)
}
