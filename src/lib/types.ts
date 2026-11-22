export interface Household {
  id: string
  name: string
  invite_code: string
  max_members: number
}

export interface Member {
  household_id: string
  user_id: string
  display_name: string
}

export interface ShoppingItem {
  id: string
  household_id: string
  name: string
  quantity: string | null
  unit: string | null
  category: string
  checked: boolean
  checked_at: string | null
  created_by: string | null
  created_at: string
}

export interface Category {
  id: string
  household_id: string
  name: string
  sort_order: number
}

export interface Tag {
  id: string
  household_id: string
  name: string
}

export interface Ingredient {
  id?: string
  name: string
  quantity: string | null
  unit: string | null
  metric?: string | null
  sort_order: number
}

export interface Modification {
  ingredient: string
  type: 'omitted' | 'replaced' | 'more'
  replacement?: string | null
}

export interface Prospect {
  id: string
  household_id: string
  store: string
  file_name: string | null
  valid_from: string | null
  valid_to: string | null
  status: 'uploaded' | 'processing' | 'ready' | 'error'
  error: string | null
  chunks_total: number
  chunks_done: number
  offer_count: number
  created_at: string
}

export interface Offer {
  id: string
  household_id: string
  prospect_id: string
  store: string
  name: string
  brand: string | null
  quantity: string | null
  price: number
  original_price: number | null
  base_price: string | null
  condition: string | null
  valid_from: string | null
  valid_to: string | null
  page: number | null
}

export interface TasteProfile {
  household_id: string
  likes: string[]
  avoids: string[]
  diet: string | null
  dismissed_hints: string[]
}

export interface Suggestion {
  name: string
  description: string
  why: string
  main_ingredients: string[]
  adaptation: string | null
  /** Gefundenes Foto mit Quelle, null wenn nichts gefunden wurde. Fehlt bei aelteren Vorschlaegen. */
  image?: {
    url: string
    credit: string
    provider: string
    page: string
    license: string | null
  } | null
}

export interface Recipe {
  id: string
  household_id: string
  title: string
  description: string | null
  steps: string[]
  servings: number | null
  total_minutes: number | null
  category_id: string | null
  source_url: string | null
  image_path: string | null
  wheel_hidden?: boolean
  /** Gemeinsame Bewertung 0 bis 5, null = noch nicht bewertet. */
  rating: number | null
  rating_note: string | null
  modifications: Modification[]
  created_at: string
  recipe_ingredients: Ingredient[]
  recipe_tags: { tag_id: string }[]
  cook_history: { id: string; cooked_at: string }[]
}

export interface Note {
  id: string
  household_id: string
  title: string
  preview: string
  content: unknown
  pinned: boolean
  updated_by: string | null
  updated_at: string
}
