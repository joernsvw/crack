export const SHOPPING_CATEGORIES = [
  'Obst & Gemüse',
  'Kühlregal',
  'Brot',
  'Trockenwaren',
  'Tiefkühl',
  'Drogerie',
  'Sonstiges',
] as const

const KEYWORDS: Record<string, string[]> = {
  'Obst & Gemüse': [
    'apfel', 'äpfel', 'banane', 'birne', 'orange', 'zitrone', 'limette', 'mandarine', 'traube', 'beere', 'kirsche',
    'pfirsich', 'nektarine', 'melone', 'mango', 'ananas', 'kiwi', 'avocado', 'tomate', 'gurke', 'paprika', 'zwiebel',
    'knoblauch', 'ingwer', 'kartoffel', 'süßkartoffel', 'möhre', 'karotte', 'salat', 'rucola', 'spinat', 'brokkoli',
    'blumenkohl', 'kohl', 'zucchini', 'aubergine', 'kürbis', 'lauch', 'porree', 'sellerie', 'pilz', 'champignon',
    'petersilie', 'schnittlauch', 'basilikum', 'koriander', 'minze', 'radieschen', 'rote bete', 'fenchel', 'spargel',
    'zuckerschote', 'lauchzwiebel', 'frühlingszwiebel',
  ],
  Kühlregal: [
    'milch', 'butter', 'sahne', 'schmand', 'crème fraîche', 'creme fraiche', 'quark', 'joghurt', 'käse', 'kaese',
    'mozzarella', 'feta', 'halloumi', 'paneer', 'parmesan', 'gouda', 'frischkäse', 'skyr', 'hafermilch', 'margarine', 'hefe', 'wurst',
    'schinken', 'salami', 'speck', 'hack', 'hackfleisch', 'hähnchen', 'huhn', 'pute', 'rind', 'schwein', 'steak',
    'lachs', 'fisch', 'tofu', 'gnocchi', 'blätterteig', 'pizzateig',
  ],
  Brot: ['brot', 'brötchen', 'toast', 'baguette', 'ciabatta', 'croissant', 'wrap', 'tortilla', 'bagel', 'laugen'],
  Trockenwaren: [
    'nudel', 'pasta', 'spaghetti', 'penne', 'fusilli', 'lasagne', 'reis', 'couscous', 'bulgur', 'quinoa', 'linsen',
    'kichererbsen', 'bohnen', 'mehl', 'zucker', 'salz', 'pfeffer', 'gewürz', 'paprikapulver', 'zimt', 'curry', 'kaffee',
    'tee', 'kakao', 'müsli', 'haferflocken', 'cornflakes', 'honig', 'marmelade', 'konfitüre', 'nutella', 'erdnussbutter',
    'tomatenmark', 'tomatensauce', 'tomatensoße', 'passierte tomaten', 'dosentomaten', 'kokosmilch', 'essig', 'senf',
    'ketchup', 'mayo', 'sojasauce', 'sojasoße', 'brühe', 'backpulver', 'vanillezucker', 'schokolade', 'chips', 'kekse',
    'nüsse', 'mandeln', 'walnüsse', 'mais', 'olivenöl', 'sonnenblumenöl', 'rapsöl', 'sesamöl', 'wasser', 'saft', 'cola',
    'limo', 'bier', 'wein', 'sprudel',
  ],
  Tiefkühl: ['tiefkühl', 'tk-', 'pizza', 'pommes', 'fischstäbchen', 'eiswürfel', 'rahmspinat', 'erbsen tk'],
  Drogerie: [
    'zahnpasta', 'zahnbürste', 'zahnseide', 'shampoo', 'duschgel', 'seife', 'deo', 'creme', 'sonnencreme', 'rasierer',
    'tampon', 'binden', 'wattepad', 'toilettenpapier', 'klopapier', 'küchenrolle', 'taschentücher', 'waschmittel',
    'spülmittel', 'spültabs', 'reiniger', 'müllbeutel', 'schwamm', 'pflaster',
  ],
}

// Zu kurz fuer eine Teilwort-Suche ("eis" steckt in "Reis", "ei" in fast allem).
const EXACT: Record<string, string> = {
  eis: 'Tiefkühl',
  ei: 'Kühlregal',
  eier: 'Kühlregal',
  öl: 'Trockenwaren',
  erbsen: 'Trockenwaren',
}

/**
 * Schlaegt eine Supermarkt-Kategorie vor. Bei deutschen Komposita steht das Grundwort hinten
 * ("Kartoffelchips" sind Chips), darum gewinnt der Treffer, der am weitesten hinten endet.
 */
export function suggestCategory(name: string): string {
  const text = name.trim().toLowerCase()
  if (EXACT[text]) return EXACT[text]

  let best: { category: string; end: number; length: number } | null = null
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      const index = text.lastIndexOf(keyword)
      if (index === -1) continue
      const end = index + keyword.length
      if (!best || end > best.end || (end === best.end && keyword.length > best.length)) {
        best = { category, end, length: keyword.length }
      }
    }
  }
  return best?.category ?? 'Sonstiges'
}

export interface ParsedItem {
  name: string
  quantity: string | null
  unit: string | null
}

const UNITS = [
  'kg', 'g', 'mg', 'l', 'ml', 'cl', 'dl', 'el', 'tl', 'stk', 'stück', 'pck', 'pkg', 'packung', 'packungen', 'dose',
  'dosen', 'glas', 'gläser', 'bund', 'becher', 'flasche', 'flaschen', 'beutel', 'tüte', 'tüten', 'prise', 'scheibe',
  'scheiben', 'zehe', 'zehen', 'netz',
]
const QUANTITY_PATTERN = /^(\d+(?:[.,/]\d+)?|[½¼¾])\s*(.*)$/

function parseOne(raw: string): ParsedItem {
  const text = raw.trim().replace(/^[-*•]\s*/, '')
  const match = QUANTITY_PATTERN.exec(text)
  if (!match || !match[2]) return { name: text, quantity: null, unit: null }

  const [firstWord, ...rest] = match[2].split(/\s+/)
  const isUnit = UNITS.includes(firstWord.replace(/\.$/, '').toLowerCase()) && rest.length > 0
  if (isUnit) return { name: rest.join(' '), quantity: match[1], unit: firstWord }
  // Ohne Leerzeichen gehoert die Zahl zum Namen ("7up"), nur eine Einheit darf direkt anschliessen ("500g").
  const separated = /\s/.test(text.charAt(match[1].length))
  return separated ? { name: match[2], quantity: match[1], unit: null } : { name: text, quantity: null, unit: null }
}

/** Zerlegt die Schnelleingabe. Ein Komma zwischen zwei Ziffern ("1,5 kg") trennt nicht. */
export function parseQuickInput(input: string): ParsedItem[] {
  return input
    .split(/\n|,(?!\d)|(?<!\d),/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseOne)
    .filter((item) => item.name)
}
