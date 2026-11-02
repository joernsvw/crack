import type { Ingredient, ShoppingItem } from '../../lib/types'
import { sameIngredient } from '../discover/logic'

// Was fast immer da ist, wird nicht vorausgewaehlt, bleibt aber sichtbar und anwaehlbar.
const STAPLES = new Set(['salz', 'pfeffer', 'salz und pfeffer', 'salz & pfeffer', 'wasser', 'öl', 'olivenöl', 'pflanzenöl', 'rapsöl'])

export type IngredientHint = 'on-list' | 'staple' | null

export interface SelectableIngredient {
  ingredient: Ingredient
  hint: IngredientHint
  selected: boolean
}

export function prepareSelection(ingredients: Ingredient[], shopping: ShoppingItem[]): SelectableIngredient[] {
  const open = shopping.filter((item) => !item.checked)
  return ingredients.map((ingredient) => {
    const hint: IngredientHint = open.some((item) => sameIngredient(item.name, ingredient.name))
      ? 'on-list'
      : STAPLES.has(ingredient.name.trim().toLowerCase())
        ? 'staple'
        : null
    return { ingredient, hint, selected: hint === null }
  })
}
