import { describe, expect, it } from 'vitest'
import type { Modification, Recipe } from '../../lib/types'
import { commonIngredients, matchRecipes, profileHints, sameIngredient, searchLinks } from './logic'

const recipe = (title: string, ingredients: string[], stars: number[] = [], mods: Modification[][] = []): Recipe => ({
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
  created_at: '2026-01-01',
  recipe_ingredients: ingredients.map((name, sort_order) => ({ name, quantity: null, unit: null, sort_order })),
  recipe_tags: [],
  recipe_ratings: (stars.length ? stars : mods.map(() => 3)).map((value, index) => ({
    id: `r${index}`,
    household_id: 'h',
    recipe_id: title,
    user_id: `u${index}`,
    stars: value,
    note: null,
    modifications: mods[index],
  })),
  cook_history: [],
})

describe('sameIngredient', () => {
  it('erkennt Varianten', () => {
    expect(sameIngredient('Reibekäse', 'käse')).toBe(true)
    expect(sameIngredient('Tomate', 'Tomaten')).toBe(true)
  })
  it('verwechselt nichts', () => {
    expect(sameIngredient('Paprika', 'Käse')).toBe(false)
    expect(sameIngredient('Weizenmehl', 'Ei')).toBe(false)
  })
})

describe('searchLinks', () => {
  it('baut kodierte Such-Adressen', () => {
    const [tiktok, pinterest, google] = searchLinks('Pasta & Pesto')
    expect(tiktok.url).toBe('https://www.tiktok.com/search?q=Pasta%20%26%20Pesto')
    expect(pinterest.url).toBe('https://www.pinterest.com/search/pins/?q=Pasta%20%26%20Pesto')
    expect(google.url).toBe('https://www.google.com/search?q=Pasta%20%26%20Pesto%20Rezept')
  })
})

describe('matchRecipes', () => {
  const omelett = recipe('Omelett', ['Eier', 'Reibekäse'], [3])
  const pizza = recipe('Pizza', ['Mehl', 'Käse', 'Tomaten', 'Salami'], [5])
  const salat = recipe('Salat', ['Gurke'])

  it('sortiert nach Anteil der vorhandenen Zutaten', () => {
    const result = matchRecipes([pizza, omelett, salat], ['Käse', 'Eier'])
    expect(result.map((entry) => entry.recipe.title)).toEqual(['Omelett', 'Pizza'])
    expect(result[0]).toMatchObject({ matched: ['Eier', 'Reibekäse'], missing: 0 })
    expect(result[1].missing).toBe(3)
  })

  it('nimmt bei Gleichstand das besser bewertete', () => {
    const a = recipe('A', ['Reis'], [2])
    const b = recipe('B', ['Reis'], [5])
    expect(matchRecipes([a, b], ['Reis'])[0].recipe.title).toBe('B')
  })

  it('zeigt Rezepte ohne Treffer nicht', () => {
    expect(matchRecipes([salat], ['Käse'])).toEqual([])
  })
})

describe('commonIngredients', () => {
  it('nimmt haeufige eigene Zutaten zuerst und fuellt auf', () => {
    const result = commonIngredients([recipe('A', ['Linsen', 'Curry']), recipe('B', ['linsen'])], 4)
    expect(result[0]).toBe('Linsen')
    expect(result).toHaveLength(4)
  })
  it('hat auch ohne Rezepte Vorschlaege und keine Dopplungen', () => {
    const result = commonIngredients([recipe('A', ['Eier']), recipe('B', ['Eier'])])
    expect(result.filter((item) => item === 'Eier')).toHaveLength(1)
  })
})

describe('profileHints', () => {
  const omit = (ingredient: string): Modification => ({ ingredient, type: 'omitted' })
  const empty = { likes: [], avoids: [], dismissed_hints: [] }
  const recipes = [
    recipe('A', [], [], [[omit('Tomaten')], [{ ingredient: 'tomaten', type: 'replaced', replacement: 'Paprika' }]]),
    recipe('B', [], [], [[omit('Tomaten'), { ingredient: 'Knoblauch', type: 'more' }], [omit('Pilze')]]),
  ]

  it('schlaegt ab 3 Mal vor', () => {
    const hints = profileHints(recipes, empty)
    expect(hints).toHaveLength(1)
    expect(hints[0]).toMatchObject({ list: 'avoids', count: 3, key: 'avoids:tomaten' })
    expect(hints[0].text).toContain('3×')
  })

  it('erkennt Vorlieben', () => {
    const more = { ingredient: 'Knoblauch', type: 'more' as const }
    const hints = profileHints([recipe('C', [], [], [[more], [more], [more]])], empty)
    expect(hints[0]).toMatchObject({ list: 'likes', ingredient: 'Knoblauch' })
  })

  it('schweigt, wenn es schon eingetragen oder abgelehnt ist', () => {
    expect(profileHints(recipes, { ...empty, avoids: ['Tomate'] })).toEqual([])
    expect(profileHints(recipes, { ...empty, dismissed_hints: ['avoids:tomaten'] })).toEqual([])
  })
})
