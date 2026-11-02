import { describe, expect, it } from 'vitest'
import type { Recipe } from '../../lib/types'
import { buildWheel, matchesWheelFilter, pickEntry, pointerAngle, spinRotation, truncateLabel, wheelWeight, type WheelFilter } from './wheel'

const NOW = new Date('2026-11-10T12:00:00Z').getTime()
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

const recipe = (title: string, extra: Partial<Recipe> = {}, stars: number[] = []): Recipe => ({
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
  recipe_ingredients: [],
  recipe_tags: [],
  recipe_ratings: stars.map((value, index) => ({ id: `${index}`, household_id: 'h', recipe_id: title, user_id: `u${index}`, stars: value, note: null })),
  cook_history: [],
  ...extra,
})

const ALL: WheelFilter = { categoryId: null, maxMinutes: null, tagIds: [], recent: 'ignore' }

describe('matchesWheelFilter', () => {
  it('filtert nach Kategorie', () => {
    const r = recipe('A', { category_id: 'backen' })
    expect(matchesWheelFilter(r, { ...ALL, categoryId: 'backen' })).toBe(true)
    expect(matchesWheelFilter(r, { ...ALL, categoryId: 'abend' })).toBe(false)
    expect(matchesWheelFilter(r, ALL)).toBe(true)
  })

  it('filtert nach Zeit und laesst Rezepte ohne Zeitangabe dann weg', () => {
    expect(matchesWheelFilter(recipe('A', { total_minutes: 20 }), { ...ALL, maxMinutes: 30 })).toBe(true)
    expect(matchesWheelFilter(recipe('A', { total_minutes: 45 }), { ...ALL, maxMinutes: 30 })).toBe(false)
    expect(matchesWheelFilter(recipe('A'), { ...ALL, maxMinutes: 30 })).toBe(false)
  })

  it('verlangt alle gewaehlten Tags', () => {
    const r = recipe('A', { recipe_tags: [{ tag_id: 'a' }, { tag_id: 'b' }] })
    expect(matchesWheelFilter(r, { ...ALL, tagIds: ['a', 'b'] })).toBe(true)
    expect(matchesWheelFilter(r, { ...ALL, tagIds: ['a', 'c'] })).toBe(false)
  })
})

describe('wheelWeight', () => {
  it('nimmt die Sterne zum Quadrat, Unbewertete im Mittelfeld', () => {
    expect(wheelWeight(recipe('A', {}, [5]), 'ignore', NOW)).toBe(25)
    expect(wheelWeight(recipe('A', {}, [4, 2]), 'ignore', NOW)).toBe(9)
    expect(wheelWeight(recipe('A'), 'ignore', NOW)).toBe(9)
  })

  it('wertet kuerzlich Gekochtes ab', () => {
    const cooked = recipe('A', { cook_history: [{ id: 'c', cooked_at: daysAgo(2) }] }, [4])
    expect(wheelWeight(cooked, 'lower', NOW)).toBe(4)
    expect(wheelWeight(cooked, 'ignore', NOW)).toBe(16)
  })

  it('zaehlt alte Kochdaten nicht als kuerzlich', () => {
    expect(wheelWeight(recipe('A', { cook_history: [{ id: 'c', cooked_at: daysAgo(8) }] }, [4]), 'lower', NOW)).toBe(16)
  })
})

describe('buildWheel', () => {
  it('laesst Ausgeblendetes weg', () => {
    const entries = buildWheel([recipe('A'), recipe('B', { wheel_hidden: true })], ALL, NOW)
    expect(entries.map((entry) => entry.recipe.title)).toEqual(['A'])
  })

  it('schliesst kuerzlich Gekochtes auf Wunsch aus', () => {
    const list = [recipe('A', { cook_history: [{ id: 'c', cooked_at: daysAgo(1) }] }), recipe('B')]
    expect(buildWheel(list, { ...ALL, recent: 'exclude' }, NOW).map((entry) => entry.recipe.title)).toEqual(['B'])
    expect(buildWheel(list, { ...ALL, recent: 'lower' }, NOW)).toHaveLength(2)
  })

  it('verteilt 360 Grad nach Gewicht', () => {
    const entries = buildWheel([recipe('A', {}, [5]), recipe('B', {}, [5]), recipe('C', {}, [5]), recipe('D', {}, [5])], ALL, NOW)
    expect(entries.map((entry) => entry.endAngle)).toEqual([90, 180, 270, 360])
    const uneven = buildWheel([recipe('A', {}, [4]), recipe('B', {}, [2])], ALL, NOW)
    expect(uneven[0].endAngle).toBeCloseTo(288)
  })

  it('kommt mit einer leeren Auswahl zurecht', () => {
    expect(buildWheel([], ALL, NOW)).toEqual([])
  })
})

describe('pickEntry', () => {
  const entries = buildWheel([recipe('A', {}, [4]), recipe('B', {}, [2])], ALL, NOW) // Gewichte 16 und 4

  it('trifft je nach Zufallswert das passende Feld', () => {
    expect(pickEntry(entries, () => 0)).toBe(0)
    expect(pickEntry(entries, () => 0.79)).toBe(0)
    expect(pickEntry(entries, () => 0.81)).toBe(1)
    expect(pickEntry(entries, () => 0.999999)).toBe(1)
  })

  it('bevorzugt gut Bewertetes im Verhaeltnis der Gewichte', () => {
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const hits = [0, 0]
    for (let i = 0; i < 20000; i++) hits[pickEntry(entries, random)]++
    expect(hits[0] / 20000).toBeGreaterThan(0.77)
    expect(hits[0] / 20000).toBeLessThan(0.83)
  })
})

describe('spinRotation', () => {
  const entry = { startAngle: 100, endAngle: 160 }

  it.each([0, 37, 1800, 2345.5])('landet von %s aus im gewaehlten Feld', (current) => {
    for (const r of [0, 0.5, 0.999]) {
      const next = spinRotation(current, entry, () => r)
      const angle = pointerAngle(next)
      expect(angle).toBeGreaterThan(100)
      expect(angle).toBeLessThan(160)
      expect(next).toBeGreaterThan(current + 5 * 360 - 1)
      expect(next).toBeLessThan(current + 6 * 360)
    }
  })

  it('funktioniert auch mit einem einzigen Feld', () => {
    expect(pointerAngle(spinRotation(0, { startAngle: 0, endAngle: 360 }, () => 0.5))).toBeCloseTo(180)
  })
})

describe('truncateLabel', () => {
  it('kuerzt nur lange Namen', () => {
    expect(truncateLabel('Pasta')).toBe('Pasta')
    expect(truncateLabel('Ein sehr langer Rezeptname hier')).toBe('Ein sehr langer R…')
  })
})
