import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../lib/types'
import { EMPTY_FILTER, filterRecipes } from './filter'

const recipe = (title: string, extra: Partial<Recipe> = {}): Recipe => ({
  id: title,
  household_id: 'h',
  title,
  description: null,
  steps: [],
  servings: null,
  total_minutes: null,
  category_id: null,
  source_url: null,
  image_path: null,
  rating: null,
  rating_note: null,
  modifications: [],
  created_at: '2026-01-01',
  recipe_ingredients: [],
  recipe_tags: [],
  cook_history: [],
  ...extra,
})

const pasta = recipe('Pasta Pesto', {
  category_id: 'abend',
  recipe_tags: [{ tag_id: 'schnell' }, { tag_id: 'veggie' }],
  rating: 4,
  recipe_ingredients: [{ name: 'Basilikum', quantity: null, unit: null, sort_order: 0 }],
  cook_history: [{ id: 'c', cooked_at: '2026-01-02' }],
})
const kuchen = recipe('Apfelkuchen', { category_id: 'backen' })
const all = [pasta, kuchen]
const titles = (filter: Partial<typeof EMPTY_FILTER>) =>
  filterRecipes(all, { ...EMPTY_FILTER, ...filter }).map((item) => item.title)

describe('filterRecipes', () => {
  it('zeigt ohne Filter alles', () => expect(titles({})).toHaveLength(2))
  it('sucht ohne Beachtung der Grossschreibung', () => expect(titles({ search: 'PASTA' })).toEqual(['Pasta Pesto']))
  it('filtert nach Kategorie', () => expect(titles({ categoryId: 'backen' })).toEqual(['Apfelkuchen']))
  it('verlangt alle gewaehlten Tags', () => {
    expect(titles({ tagIds: ['schnell', 'veggie'] })).toEqual(['Pasta Pesto'])
    expect(titles({ tagIds: ['schnell', 'gaeste'] })).toEqual([])
  })
  it('nutzt die gemeinsame Bewertung fuer die Mindestbewertung', () => {
    expect(titles({ minStars: 4 })).toEqual(['Pasta Pesto'])
    expect(titles({ minStars: 5 })).toEqual([])
  })
  it('laesst Unbewertetes und "Nie wieder" bei einer Mindestbewertung weg', () => {
    const never = recipe('Nie', { rating: 0 })
    expect(filterRecipes([never, kuchen], { ...EMPTY_FILTER, minStars: 3 })).toEqual([])
    expect(filterRecipes([never], EMPTY_FILTER)).toHaveLength(1)
  })
  it('findet Rezepte ueber Zutaten', () => expect(titles({ ingredient: 'basil' })).toEqual(['Pasta Pesto']))
  it('zeigt nur noch nicht Gekochtes', () => expect(titles({ notCooked: true })).toEqual(['Apfelkuchen']))
})
