import { describe, expect, it } from 'vitest'
import { cleanSuggestions, matchesTerm, parseLeftovers, parsePexels, parseWikimedia, type Suggestion } from './suggest'

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

describe('parsePexels', () => {
  it('nimmt das erste Foto mit Fotograf und Seite', () => {
    const json = { photos: [{ url: 'https://www.pexels.com/photo/1/', photographer: ' Ana ', src: { large: 'https://images.pexels.com/1.jpg', medium: 'https://images.pexels.com/1m.jpg' } }] }
    expect(parsePexels(json)).toEqual({ url: 'https://images.pexels.com/1.jpg', credit: 'Ana', provider: 'Pexels', page: 'https://www.pexels.com/photo/1/', license: null })
  })
  it('liefert null ohne Treffer oder bei unsicheren Adressen', () => {
    expect(parsePexels({ photos: [] })).toBeNull()
    expect(parsePexels(null)).toBeNull()
    expect(parsePexels({ photos: [{ url: 'x', src: { large: 'http://unsicher.jpg' } }] })).toBeNull()
  })
})

describe('parseWikimedia', () => {
  const info = (mime: string, thumb = 'https://upload.wikimedia.org/a.jpg') => ({
    thumburl: thumb,
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    mime,
    extmetadata: { Artist: { value: '<a href="x">Max <b>M.</b></a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } },
  })

  it('nimmt das erste Foto in Trefferreihenfolge und bereinigt den Urheber', () => {
    const json = { query: { pages: { '9': { index: 2, imageinfo: [info('image/jpeg', 'https://upload.wikimedia.org/b.jpg')] }, '5': { index: 1, imageinfo: [info('image/jpeg')] } } } }
    expect(parseWikimedia(json)).toEqual({
      url: 'https://upload.wikimedia.org/a.jpg',
      credit: 'Max M.',
      provider: 'Wikimedia Commons',
      page: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      license: 'CC BY-SA 4.0',
    })
  })
  it('ueberspringt Grafiken und PDFs', () => {
    const json = { query: { pages: { '1': { index: 1, imageinfo: [info('image/svg+xml')] }, '2': { index: 2, imageinfo: [info('application/pdf')] } } } }
    expect(parseWikimedia(json)).toBeNull()
  })
  it('kommt mit leeren Antworten zurecht', () => {
    expect(parseWikimedia({})).toBeNull()
    expect(parseWikimedia(undefined)).toBeNull()
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
