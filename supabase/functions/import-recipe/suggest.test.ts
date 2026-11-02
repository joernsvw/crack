import { describe, expect, it } from 'vitest'
import { cleanSuggestions, matchesTerm, parseLeftovers, type Suggestion } from './suggest'

const dish = (name: string, main: string[], extra: Partial<Suggestion> = {}): Suggestion => ({
  name,
  description: ' Lecker ',
  why: ' Passt ',
  main_ingredients: main,
  adaptation: null,
  ...extra,
})

describe('matchesTerm', () => {
  it.each([
    ['Tomaten', 'Tomate'],
    ['Kirschtomaten', 'tomaten'],
    ['Tomate', 'Tomaten'],
  ])('%s trifft %s', (a, b) => expect(matchesTerm(a, b)).toBe(true))

  it('ignoriert andere Zutaten', () => expect(matchesTerm('Paprika', 'Tomaten')).toBe(false))
  it('laesst sehr kurze Begriffe nicht alles treffen', () => {
    expect(matchesTerm('Weizenmehl', 'Ei')).toBe(false)
    expect(matchesTerm('Ei', 'Ei')).toBe(true)
  })
})

describe('cleanSuggestions', () => {
  const options = { avoids: ['Tomaten'], excluded: ['Pasta Pesto'], limit: 2 }

  it('filtert Gerichte, die auf gemiedenen Zutaten aufbauen', () => {
    const result = cleanSuggestions([dish('Shakshuka', ['Eier', 'Kirschtomaten']), dish('Dal', ['Linsen'])], options)
    expect(result.map((entry) => entry.name)).toEqual(['Dal'])
  })

  it('laesst Gerichte durch, die nur einen Hinweis zur Zutat haben', () => {
    const result = cleanSuggestions([dish('Dal', ['Linsen'], { adaptation: 'geht auch ohne Tomaten' })], options)
    expect(result[0].adaptation).toBe('geht auch ohne Tomaten')
  })

  it('schlaegt Vorhandenes und Doppeltes nicht vor', () => {
    const result = cleanSuggestions([dish('pasta pesto', ['Nudeln']), dish('Dal', ['Linsen']), dish('DAL', ['Linsen'])], options)
    expect(result.map((entry) => entry.name)).toEqual(['Dal'])
  })

  it('haelt das Limit ein und bereinigt Texte', () => {
    const result = cleanSuggestions([dish('A', ['x1']), dish('B', ['x2']), dish('C', ['x3'])], options)
    expect(result).toHaveLength(2)
    expect(result[0].description).toBe('Lecker')
  })

  it('ohne Name kein Vorschlag', () => {
    expect(cleanSuggestions([dish(' ', ['Linsen'])], options)).toEqual([])
  })
})

describe('parseLeftovers', () => {
  it('bereinigt die Eingabe', () => {
    expect(parseLeftovers([' Käse ', 'käse', '', 5, 'Paprika'])).toEqual(['Käse', 'Paprika'])
  })
  it('ignoriert falsche Typen', () => {
    expect(parseLeftovers('Käse')).toEqual([])
    expect(parseLeftovers(undefined)).toEqual([])
  })
  it('begrenzt die Menge', () => {
    expect(parseLeftovers(Array.from({ length: 50 }, (_, i) => `Zutat ${i}`))).toHaveLength(30)
  })
})
