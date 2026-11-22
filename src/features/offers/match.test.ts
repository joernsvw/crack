import { describe, expect, it } from 'vitest'
import type { Offer, Prospect, Recipe, ShoppingItem } from '../../lib/types'
import { activeOffers, compareShoppingList, findOffers, ingredientKey, isStuck, matchOffer, nextMonday, offerValidOn, scanRecipes, stem } from './match'

const offer = (name: string, price: number, extra: Partial<Offer> = {}): Offer => ({
  id: `${name}-${price}`,
  household_id: 'h',
  prospect_id: 'p',
  store: 'Lidl',
  name,
  brand: null,
  quantity: null,
  price,
  original_price: null,
  base_price: null,
  condition: null,
  valid_from: null,
  valid_to: null,
  page: null,
  ...extra,
})

const prospect = (extra: Partial<Prospect> = {}): Prospect => ({
  id: 'p',
  household_id: 'h',
  store: 'Lidl',
  file_name: null,
  valid_from: '2026-11-23',
  valid_to: '2026-11-28',
  status: 'ready',
  error: null,
  chunks_total: 1,
  chunks_done: 1,
  offer_count: 1,
  created_at: '2026-11-20',
  updated_at: '2026-11-20',
  ...extra,
})

describe('stem und ingredientKey', () => {
  it('kuerzt Endungen fuer den Vergleich', () => {
    expect(stem('tomaten')).toBe(stem('tomate'))
    expect(stem('ei')).toBe('ei')
  })
  it('nimmt das Hauptwort und loest Synonyme auf', () => {
    expect(ingredientKey('Rote Zwiebeln')).toBe('zwiebeln')
    expect(ingredientKey('Hack (gemischt)')).toBe('hackfleisch')
    expect(ingredientKey('Hack gemischt')).toBe('hackfleisch')
    expect(ingredientKey('Paprika rot')).toBe('paprika')
    expect(ingredientKey('Hack')).toBe('hackfleisch')
    expect(ingredientKey('Paprikaschoten')).toBe('paprika')
    expect(ingredientKey('500 g')).toBeNull()
  })
})

describe('matchOffer', () => {
  it.each([
    ['Hähnchenbrustfilet', 'Hähnchen-Brustfilets 600 g', 'sure'],
    ['Tomaten', 'Tomaten', 'sure'],
    ['Tomate', 'Rispentomaten', 'likely'],
    ['Hack', 'Hackfleisch gemischt', 'sure'],
    ['Paprikaschoten', 'Paprika rot', 'sure'],
    ['Cocktailtomaten', 'Tomaten 500 g', 'likely'],
    ['Butter', 'Deutsche Markenbutter', 'likely'],
  ])('%s passt zu %s (%s)', (ingredient, name, expected) => {
    expect(matchOffer(ingredient, name)).toBe(expected)
  })

  it.each([
    ['Salz', 'Salzstangen'],
    ['Zwiebeln', 'Zwiebelmettwurst'],
    ['Käse', 'Käsekuchen'],
    ['Milch', 'Milchschokolade'],
    ['Reis', 'Preiselbeeren'],
  ])('%s passt nicht zu %s', (ingredient, name) => {
    expect(matchOffer(ingredient, name)).toBeNull()
  })
})

describe('Gueltigkeit', () => {
  it('nutzt die Daten des Prospekts, eigene Daten des Angebots gehen vor', () => {
    const p = prospect()
    expect(offerValidOn(offer('A', 1), p, '2026-11-25')).toBe(true)
    expect(offerValidOn(offer('A', 1), p, '2026-11-30')).toBe(false)
    expect(offerValidOn(offer('A', 1, { valid_from: '2026-11-27' }), p, '2026-11-25')).toBe(false)
  })

  it('zeigt nur Angebote fertig ausgelesener Prospekte', () => {
    const offers = [offer('A', 1), offer('B', 1, { prospect_id: 'q' })]
    expect(activeOffers(offers, [prospect(), prospect({ id: 'q', status: 'processing' })], '2026-11-25').map((entry) => entry.name)).toEqual(['A'])
  })

  it('erkennt haengengebliebenes Auslesen erst nach fuenf Minuten ohne Fortschritt', () => {
    const now = new Date('2026-11-22T12:10:00Z').getTime()
    expect(isStuck(prospect({ status: 'processing', updated_at: '2026-11-22T12:04:00Z' }), now)).toBe(true)
    expect(isStuck(prospect({ status: 'processing', updated_at: '2026-11-22T12:06:00Z' }), now)).toBe(false)
    expect(isStuck(prospect({ status: 'ready', updated_at: '2026-11-22T11:00:00Z' }), now)).toBe(false)
  })

  it('findet den naechsten Montag', () => {
    expect(nextMonday(new Date(2026, 10, 22)).getDate()).toBe(23)
    expect(nextMonday(new Date(2026, 10, 23)).getDate()).toBe(30)
  })
})

describe('findOffers', () => {
  it('stellt sichere Treffer vor vermutliche, darin das guenstigste zuerst', () => {
    const offers = [offer('Rispentomaten', 0.99), offer('Tomaten', 1.49, { store: 'Netto' }), offer('Tomaten', 1.29)]
    expect(findOffers('Tomaten', offers).map((entry) => [entry.offer.name, entry.offer.price, entry.confidence])).toEqual([
      ['Tomaten', 1.29, 'sure'],
      ['Tomaten', 1.49, 'sure'],
      ['Rispentomaten', 0.99, 'likely'],
    ])
  })
})

const recipe = (title: string, rating: number | null, ingredients: string[], cooked = true): Recipe => ({
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
  cook_history: cooked ? [{ id: 'c', cooked_at: '2026-11-01' }] : [],
})

describe('scanRecipes', () => {
  const offers = [offer('Hackfleisch gemischt', 3.99), offer('Tomaten', 1.29), offer('Rispentomaten', 0.99)]

  it('sortiert nach Anzahl der Angebotszutaten, dann nach Bewertung', () => {
    const list = [
      recipe('Nur Tomaten', 5, ['Tomaten', 'Basilikum']),
      recipe('Bolognese', 3, ['Hack', 'Tomaten', 'Nudeln']),
      recipe('Noch nie gekocht', 5, ['Hack', 'Tomaten'], false),
      recipe('Nie wieder', 0, ['Hack', 'Tomaten']),
    ]
    const result = scanRecipes(list, offers)
    expect(result.map((scan) => scan.recipe.title)).toEqual(['Bolognese', 'Nur Tomaten'])
    expect(result[0].matches.map((match) => [match.ingredient, match.best.offer.name, match.count])).toEqual([
      ['Hack', 'Hackfleisch gemischt', 1],
      ['Tomaten', 'Tomaten', 2],
    ])
  })
})

describe('compareShoppingList', () => {
  it('vergleicht nur offene Eintraege', () => {
    const item = (name: string, checked = false): ShoppingItem => ({
      id: name,
      household_id: 'h',
      name,
      quantity: null,
      unit: null,
      category: 'Sonstiges',
      checked,
      checked_at: null,
      created_by: null,
      created_at: '2026-01-01',
    })
    const result = compareShoppingList([item('Tomaten'), item('Hack', true)], [offer('Tomaten', 1.29)])
    expect(result.map((entry) => [entry.item.name, entry.matches.length])).toEqual([['Tomaten', 1]])
  })
})
