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
  sort_order: number
}

export interface Rating {
  id: string
  household_id: string
  recipe_id: string
  user_id: string
  stars: number
  note: string | null
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
  created_at: string
  recipe_ingredients: Ingredient[]
  recipe_tags: { tag_id: string }[]
  recipe_ratings: Rating[]
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
