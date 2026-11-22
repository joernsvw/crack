import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../lib/types'
import { cookedAtFromDate, lastCooked, overdueDays, overviewList, todayInputValue } from './overview'

const NOW = new Date('2026-11-22T12:00:00Z').getTime()
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

const recipe = (title: string, rating: number | null, cooked: string[] = []): Recipe => ({
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
  recipe_ingredients: [],
  recipe_tags: [],
  cook_history: cooked.map((cooked_at, index) => ({ id: `${title}${index}`, cooked_at })),
})

describe('lastCooked', () => {
  it('nimmt den juengsten Eintrag, egal in welcher Reihenfolge', () => {
    expect(lastCooked(recipe('A', 3, [daysAgo(10), daysAgo(2), daysAgo(30)]))).toBe(daysAgo(2))
    expect(lastCooked(recipe('A', 3))).toBeNull()
  })
})

describe('overdueDays', () => {
  it('meldet 5 Sterne nach 4 Wochen als ueberfaellig', () => {
    expect(overdueDays(recipe('A', 5, [daysAgo(28)]), NOW)).toBe(21)
  })
  it('laesst einen kleinen Verzug durchgehen', () => {
    expect(overdueDays(recipe('A', 5, [daysAgo(9)]), NOW)).toBeNull()
  })
  it('richtet sich nach der Bewertung', () => {
    expect(overdueDays(recipe('A', 3, [daysAgo(40)]), NOW)).toBeNull()
    expect(overdueDays(recipe('A', 3, [daysAgo(50)]), NOW)).toBe(20)
  })
  it('kennt keinen Rhythmus fuer nie gekocht, unbewertet oder "nie wieder"', () => {
    expect(overdueDays(recipe('A', 5), NOW)).toBeNull()
    expect(overdueDays(recipe('A', null, [daysAgo(400)]), NOW)).toBeNull()
    expect(overdueDays(recipe('A', 0, [daysAgo(400)]), NOW)).toBeNull()
  })
})

describe('overviewList', () => {
  const list = [
    recipe('Chili', 2, [daysAgo(3)]),
    recipe('Auflauf', null, [daysAgo(1)]),
    recipe('Burger', 5, [daysAgo(20)]),
    recipe('Dal', 0, [daysAgo(60)]),
    recipe('Eintopf', 4),
  ]
  const titles = (options: Parameters<typeof overviewList>[1]) => overviewList(list, options).map((entry) => entry.title)

  it('trennt gekocht und gespeichert', () => {
    expect(titles({ tab: 'saved', sort: 'rating', search: '' })).toEqual(['Eintopf'])
    expect(titles({ tab: 'cooked', sort: 'name', search: '' })).toEqual(['Auflauf', 'Burger', 'Chili', 'Dal'])
  })
  it('sortiert nach Bewertung, Unbewertetes zuletzt', () => {
    expect(titles({ tab: 'cooked', sort: 'rating', search: '' })).toEqual(['Burger', 'Chili', 'Dal', 'Auflauf'])
  })
  it('sortiert nach zuletzt gekocht', () => {
    expect(titles({ tab: 'cooked', sort: 'recent', search: '' })).toEqual(['Auflauf', 'Chili', 'Burger', 'Dal'])
  })
  it('sucht ohne Beachtung der Grossschreibung', () => {
    expect(titles({ tab: 'cooked', sort: 'name', search: 'BUR' })).toEqual(['Burger'])
  })
})

describe('Datum', () => {
  it('speichert ein Tagesdatum mittags', () => {
    expect(new Date(cookedAtFromDate('2026-11-20')).getHours()).toBe(12)
  })
  it('liefert das heutige Datum fuer das Eingabefeld', () => {
    expect(todayInputValue(new Date(2026, 10, 22, 23, 30))).toBe('2026-11-22')
  })
})
