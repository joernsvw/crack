import type { Recipe } from '../../lib/types'

export interface RecipeFilter {
  search: string
  categoryId: string | null
  tagIds: string[]
  minStars: number
  ingredient: string
  notCooked: boolean
}

export const EMPTY_FILTER: RecipeFilter = {
  search: '',
  categoryId: null,
  tagIds: [],
  minStars: 0,
  ingredient: '',
  notCooked: false,
}

export function filterRecipes(recipes: Recipe[], filter: RecipeFilter): Recipe[] {
  const search = filter.search.trim().toLowerCase()
  const ingredient = filter.ingredient.trim().toLowerCase()

  return recipes.filter((recipe) => {
    if (search && !recipe.title.toLowerCase().includes(search)) return false
    if (filter.categoryId && recipe.category_id !== filter.categoryId) return false
    if (filter.notCooked && recipe.cook_history.length > 0) return false
    if (filter.tagIds.length > 0) {
      const own = new Set(recipe.recipe_tags.map((tag) => tag.tag_id))
      if (!filter.tagIds.every((id) => own.has(id))) return false
    }
    if (filter.minStars > 0) {
      const ratings = recipe.recipe_ratings
      const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length : 0
      if (average < filter.minStars) return false
    }
    if (ingredient && !recipe.recipe_ingredients.some((item) => item.name.toLowerCase().includes(ingredient))) {
      return false
    }
    return true
  })
}
