// Reine Hilfsfunktionen ohne Netz und ohne Deno-APIs, damit sie sich mit vitest testen lassen.

const MAX_PAGE_TEXT = 30_000

// ---------------------------------------------------------------------------
// Schutz vor Anfragen ins interne Netz (SSRF)
// ---------------------------------------------------------------------------

export function isPrivateIp(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, '')
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value)
  if (mapped) return isPrivateIp(mapped[1])

  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  if (value.includes(':')) {
    return value === '::' || value === '::1' || /^f[cd]/.test(value) || /^fe[89ab]/.test(value)
  }
  return false
}

/** Prueft eine Adresse, bevor sie abgerufen wird. Gibt null zurueck, wenn sie nicht erlaubt ist. */
export function parseSafeUrl(raw: string, base?: string): URL | null {
  let url: URL
  try {
    url = new URL(raw.trim(), base)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (url.port && url.port !== '80' && url.port !== '443') return null

  const host = url.hostname.toLowerCase()
  if (!host.includes('.') || host.includes(':') || host.startsWith('[')) return null
  if (/\.(localhost|local|internal|intranet|lan|home|corp)$/.test(host)) return null
  if (/^[\d.]+$/.test(host) && isPrivateIp(host)) return null
  return url
}

// ---------------------------------------------------------------------------
// HTML auslesen
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü',
  Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è', ndash: '–', mdash: '—', hellip: '…',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== '#') return ENTITIES[code] ?? match
    const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match
  })
}

/** Liest einen Meta-Tag, zum Beispiel og:title. Attribut-Reihenfolge und Anfuehrungszeichen sind egal. */
export function metaContent(html: string, names: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? ''
    }
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase()
    if (names.includes(key) && attrs.content) return decodeEntities(attrs.content).trim()
  }
  return null
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(stripped)
    .replace(/[ \t\f\r]+/g, ' ')
    .replace(/ *\n\s*/g, '\n')
    .trim()
    .slice(0, MAX_PAGE_TEXT)
}

export interface JsonLdRecipe {
  name?: string
  description?: string
  recipeIngredient?: string[]
  recipeInstructions?: string[]
  recipeYield?: unknown
  totalTime?: string
  imageUrl?: string
}

function isRecipeNode(node: Record<string, unknown>): boolean {
  const type = node['@type']
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
}

function findRecipeNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findRecipeNode(entry)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    if (isRecipeNode(node)) return node
    return findRecipeNode(node['@graph'])
  }
  return null
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === 'string') return [decodeEntities(value).trim()].filter(Boolean)
  if (Array.isArray(value)) return value.flatMap(flattenInstructions)
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>
    return flattenInstructions(node.itemListElement ?? node.text ?? node.name)
  }
  return []
}

function firstImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return firstImageUrl(value[0])
  if (value && typeof value === 'object') return firstImageUrl((value as Record<string, unknown>).url)
  return undefined
}

/** Viele Rezeptseiten liefern schema.org-Daten mit. Die sind genauer und guenstiger als der Seitentext. */
export function findJsonLdRecipe(html: string): JsonLdRecipe | null {
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const match of html.matchAll(pattern)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1].trim())
    } catch {
      continue
    }
    const node = findRecipeNode(parsed)
    if (!node) continue
    return {
      name: typeof node.name === 'string' ? decodeEntities(node.name) : undefined,
      description: typeof node.description === 'string' ? decodeEntities(node.description) : undefined,
      recipeIngredient: Array.isArray(node.recipeIngredient)
        ? node.recipeIngredient.filter((item): item is string => typeof item === 'string').map(decodeEntities)
        : undefined,
      recipeInstructions: flattenInstructions(node.recipeInstructions),
      recipeYield: node.recipeYield,
      totalTime: typeof node.totalTime === 'string' ? node.totalTime : undefined,
      imageUrl: firstImageUrl(node.image),
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Antwort der KI
// ---------------------------------------------------------------------------

export const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'servings', 'total_minutes', 'category', 'tags', 'ingredients', 'steps'],
  properties: {
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    servings: { type: ['integer', 'null'] },
    total_minutes: { type: ['integer', 'null'] },
    category: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit'],
        properties: {
          name: { type: 'string' },
          quantity: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
} as const

export interface ModelRecipe {
  title: string
  description: string | null
  servings: number | null
  total_minutes: number | null
  category: string | null
  tags: string[]
  ingredients: { name: string; quantity: string | null; unit: string | null }[]
  steps: string[]
}

export interface RecipeDraft extends Omit<ModelRecipe, 'category'> {
  category_id: string | null
}

const blankToNull = (value: string | null | undefined) => value?.trim() || null
const positive = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null

/** Bringt die Antwort in die Form, die das Formular und die Datenbank erwarten. */
export function normalizeDraft(
  recipe: ModelRecipe,
  categories: { id: string; name: string }[],
  fallbackTitle: string,
): RecipeDraft {
  const category = recipe.category?.trim().toLowerCase()
  const seenTags = new Set<string>()
  return {
    title: (recipe.title?.trim() || fallbackTitle).slice(0, 200),
    description: blankToNull(recipe.description),
    servings: positive(recipe.servings),
    total_minutes: positive(recipe.total_minutes),
    category_id: categories.find((entry) => entry.name.toLowerCase() === category)?.id ?? null,
    tags: recipe.tags
      .map((tag) => tag.trim().slice(0, 40))
      .filter((tag) => {
        const key = tag.toLowerCase()
        if (!tag || seenTags.has(key)) return false
        seenTags.add(key)
        return true
      })
      .slice(0, 6),
    ingredients: recipe.ingredients
      .map((item) => ({
        name: item.name?.trim().slice(0, 200) ?? '',
        quantity: blankToNull(item.quantity),
        unit: blankToNull(item.unit),
      }))
      .filter((item) => item.name),
    steps: recipe.steps.map((step) => step.trim()).filter(Boolean),
  }
}
