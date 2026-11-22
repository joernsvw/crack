import { describe, expect, it } from 'vitest'
import type { Offer, Recipe, Suggestion } from '../../lib/types'
import { weekPlan } from './weekPlan'

const NOW = new Date('2026-11-22T12:00:00').getTime()

const recipe = (title: string, rating: number | null, ingredients: string[], cookedDaysAgo: number | null = 60): Recipe => ({
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
  rating,
  rating_note: null,
  modifications: [],
  created_at: '2026-01-01',
  recipe_ingredients: ingredients.map((name, sort_order) => ({ name, quantity: null, unit: null, sort_order })),
  recipe_tags: [],
  cook_history: cookedDaysAgo === null ? [] : [{ id: 'c', cooked_at: new Date(NOW - cookedDaysAgo * 86_400_000).toISOString() }],
})

const offer = (name: string): Offer => ({
  id: name,
  household_id: 'h',
  prospect_id: 'p',
  store: 'Lidl',
  name,
  brand: null,
  quantity: null,
  price: 1,
  original_price: null,
  base_price: null,
  condition: null,
  valid_from: null,
  valid_to: null,
  page: null,
})

const idea = (name: string, main_ingredients: string[]): Suggestion => ({ name, description: '', why: '', main_ingredients, adaptation: null })

describe('weekPlan', () => {
  const recipes = [
    recipe('Bolognese', 4, ['Hack', 'Tomaten']),
    recipe('Curry', 5, ['Reis', 'Kokosmilch']),
    recipe('Gestern gekocht', 5, ['Hack'], 1),
    recipe('Mittelmaessig', 2, ['Hack']),
    recipe('Nie wieder', 0, ['Hack']),
    recipe('Unbewertet', null, ['Hack']),
  ]
  const offers = [offer('Hackfleisch gemischt'), offer('Tomaten')]

  it('stellt Gerichte mit Angebotszutaten nach vorn und laesst Schwaches und gerade Gekochtes weg', () => {
    const plan = weekPlan(recipes, offers, [], { now: NOW })
    expect(plan.map((entry) => (entry.kind === 'recipe' ? entry.recipe.title : entry.suggestion.name))).toEqual(['Bolognese', 'Curry'])
    expect(plan[0].reasons).toEqual(['2 Zutaten im Angebot', 'Lieblingsgericht', 'Mal wieder fällig'])
  })

  it('nimmt hoechstens eine neue Idee dazu, die mit den meisten Angebotszutaten', () => {
    const plan = weekPlan(recipes, offers, [idea('Ohne', ['Tofu']), idea('Lasagne', ['Hack', 'Tomaten'])], { now: NOW, days: 3 })
    expect(plan.map((entry) => entry.kind)).toEqual(['recipe', 'recipe', 'idea'])
    expect(plan[2].kind === 'idea' && plan[2].suggestion.name).toBe('Lasagne')
  })

  it('plant nur so viele Tage wie gewuenscht und bei wenigen Tagen ohne neue Idee', () => {
    const plan = weekPlan(recipes, offers, [idea('Lasagne', ['Hack'])], { now: NOW, days: 2 })
    expect(plan.map((entry) => entry.kind === 'recipe' && entry.recipe.title)).toEqual(['Bolognese', 'Curry'])
    expect(weekPlan(recipes, offers, [], { now: NOW, days: 1 })).toHaveLength(1)
  })

  it('kann einzelne Eintraege fuer einen neuen Vorschlag ueberspringen', () => {
    const plan = weekPlan(recipes, offers, [], { now: NOW, skip: ['Bolognese'] })
    expect(plan.map((entry) => entry.kind === 'recipe' && entry.recipe.title)).toEqual(['Curry'])
  })
})
