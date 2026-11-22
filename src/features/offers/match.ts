import type { Offer, Prospect, Recipe, ShoppingItem } from '../../lib/types'

export type MatchConfidence = 'sure' | 'likely'

export interface OfferMatch {
  offer: Offer
  confidence: MatchConfidence
}

// Haeufige Namen fuer dasselbe. Links steht, was in Rezepten vorkommt, rechts der Begriff fuer den Abgleich.
const SYNONYMS: Record<string, string> = {
  hack: 'hackfleisch',
  gehacktes: 'hackfleisch',
  rinderhack: 'hackfleisch',
  schlagsahne: 'sahne',
  paprikaschote: 'paprika',
  paprikaschoten: 'paprika',
  speisekartoffeln: 'kartoffeln',
  frühlingszwiebeln: 'lauchzwiebeln',
  lauchzwiebel: 'lauchzwiebeln',
  hähnchenbrust: 'hähnchenbrustfilet',
  hühnerbrust: 'hähnchenbrustfilet',
  reibekäse: 'geriebenerkäse',
  creme: 'crèmefraîche',
}

// Woerter, die nichts ueber das Produkt sagen.
const STOPWORDS = new Set(['frisch', 'frische', 'frischer', 'bio', 'deutsche', 'deutscher', 'aus', 'der', 'die', 'das', 'und', 'mit', 'oder', 'klasse', 'original', 'premium', 'versch', 'sorten', 'je'])

// Zutaten, die man so gut wie immer im Haus hat. Sie sollen den Abgleich nicht aufblaehen.
const STAPLES = new Set(['salz', 'pfeffer', 'wasser', 'öl', 'zucker', 'mehl'])

const UNIT_PATTERN = /\b\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?\s*)?(?:g|kg|mg|ml|l|cl|stück|stk|st|pack|packung|dose|glas|bund|beutel)\b\.?/gi

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(UNIT_PATTERN, ' ')
    .replace(/[-–/]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
}

/** Einfaches Wortstammkuerzen fuer den Vergleich: "tomaten" und "tomate" werden gleich. */
export function stem(word: string): string {
  for (const ending of ['en', 'er', 'n', 'e', 's']) {
    if (word.length > ending.length + 3 && word.endsWith(ending)) return word.slice(0, -ending.length)
  }
  return word
}

// Beschreibungen, die im Rezept oft hinter dem Hauptwort stehen: "Hack gemischt", "Paprika rot".
const DESCRIPTIONS = new Set([
  'rot', 'rote', 'roter', 'grün', 'grüne', 'gelb', 'gelbe', 'gemischt', 'gemischtes', 'gehackt', 'gehackte', 'gerieben', 'geriebener',
  'gewürfelt', 'getrocknet', 'getrocknete', 'gefroren', 'tk', 'fein', 'grob', 'klein', 'kleine', 'groß', 'große', 'gekocht', 'optional',
])

/** Der Begriff, unter dem eine Zutat gesucht wird: das Hauptwort, Synonyme aufgeloest. "Rote Zwiebeln" sucht "zwiebeln". */
export function ingredientKey(name: string): string | null {
  const parts = words(name.replace(/\([^)]*\)/g, ' ')).filter((word) => !DESCRIPTIONS.has(word))
  if (parts.length === 0) return null
  const joined = parts.join('')
  if (SYNONYMS[joined]) return SYNONYMS[joined]
  const head = parts[parts.length - 1]
  return SYNONYMS[head] ?? head
}

/**
 * Vergleicht eine Zutat mit einem Angebot. Deutsche Zusammensetzungen haben das Hauptwort hinten:
 * "Kirschtomaten" sind Tomaten, "Salzstangen" aber kein Salz. Treffer im zusammengesetzten Wort gelten nur als vermutlich passend.
 */
export function matchOffer(ingredient: string, offerName: string): MatchConfidence | null {
  const key = ingredientKey(ingredient)
  if (!key || key.length < 3 || STAPLES.has(key)) return null
  const target = stem(key)
  const tokens = words(offerName)
  const joined = tokens.join('')
  if (tokens.some((token) => stem(token) === target) || stem(joined) === target) return 'sure'
  if (target.length >= 4 && (tokens.some((token) => stem(token).endsWith(target)) || stem(joined).endsWith(target))) return 'likely'
  // Umgekehrt: Angebot "Tomaten" passt vermutlich zur Zutat "Cocktailtomaten".
  const ingredientJoined = stem(words(ingredient).join(''))
  if (tokens.some((token) => stem(token).length >= 5 && ingredientJoined.endsWith(stem(token)))) return 'likely'
  return null
}

/** So lange ohne Fortschritt gilt ein Auslesen als haengengeblieben. Die Edge Function nutzt denselben Wert. */
export const STALE_MS = 5 * 60_000

export function isStuck(prospect: Prospect, now = Date.now()): boolean {
  return prospect.status === 'processing' && now - new Date(prospect.updated_at).getTime() > STALE_MS
}

/** Ein Tag als JJJJ-MM-TT in Ortszeit. */
export function isoDay(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Der Montag der naechsten Woche, fuer die Ansicht "Naechste Woche". */
export function nextMonday(now = new Date()): Date {
  const date = new Date(now)
  date.setDate(date.getDate() + (((8 - date.getDay()) % 7) || 7))
  return date
}

/** Gilt das Angebot an diesem Tag? Eigene Daten des Angebots gehen vor denen des Prospekts. */
export function offerValidOn(offer: Offer, prospect: Prospect | undefined, day: string): boolean {
  const from = offer.valid_from ?? prospect?.valid_from ?? null
  const to = offer.valid_to ?? prospect?.valid_to ?? null
  return (!from || from <= day) && (!to || to >= day)
}

export function activeOffers(offers: Offer[], prospects: Prospect[], day: string): Offer[] {
  const byId = new Map(prospects.map((prospect) => [prospect.id, prospect]))
  return offers.filter((offer) => byId.get(offer.prospect_id)?.status === 'ready' && offerValidOn(offer, byId.get(offer.prospect_id), day))
}

export function findOffers(ingredient: string, offers: Offer[]): OfferMatch[] {
  return offers
    .map((offer) => ({ offer, confidence: matchOffer(ingredient, `${offer.name} ${offer.brand ?? ''}`) }))
    .filter((entry): entry is OfferMatch => entry.confidence !== null)
    .sort((a, b) => (a.confidence === b.confidence ? a.offer.price - b.offer.price : a.confidence === 'sure' ? -1 : 1))
}

export interface RecipeScan {
  recipe: Recipe
  matches: { ingredient: string; best: OfferMatch; count: number }[]
  score: number
}

/** Gekochte Gerichte mit den meisten Zutaten im Angebot zuerst, bei Gleichstand das besser bewertete. */
export function scanRecipes(recipes: Recipe[], offers: Offer[]): RecipeScan[] {
  return recipes
    .filter((recipe) => recipe.cook_history.length > 0 && recipe.rating !== 0)
    .map((recipe) => {
      const matches = recipe.recipe_ingredients.flatMap((ingredient) => {
        const found = findOffers(ingredient.name, offers)
        return found.length ? [{ ingredient: ingredient.name, best: found[0], count: found.length }] : []
      })
      const score = matches.reduce((sum, match) => sum + (match.best.confidence === 'sure' ? 1 : 0.5), 0)
      return { recipe, matches, score }
    })
    .filter((scan) => scan.matches.length > 0)
    .sort((a, b) => b.score - a.score || (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0))
}

export interface ItemComparison {
  item: ShoppingItem
  matches: OfferMatch[]
}

/** Fuer jeden offenen Eintrag der Einkaufsliste die passenden Angebote, das guenstigste zuerst. */
export function compareShoppingList(items: ShoppingItem[], offers: Offer[]): ItemComparison[] {
  return items
    .filter((item) => !item.checked)
    .map((item) => ({ item, matches: findOffers(item.name, offers) }))
}

export function formatPrice(value: number): string {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
