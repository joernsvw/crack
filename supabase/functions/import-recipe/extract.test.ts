import { describe, expect, it } from 'vitest'
import {
  decodeEntities,
  exactMetric,
  findJsonLdRecipe,
  findTikTokPost,
  firstUsable,
  htmlToText,
  isPrivateIp,
  metaContent,
  normalizeDraft,
  parseAmount,
  parseSafeUrl,
  pickSubtitle,
  vttToText,
} from './extract'

describe('parseSafeUrl', () => {
  it.each([
    'https://www.tiktok.com/@koch/video/123',
    'http://chefkoch.de/rezepte/1',
    'https://pin.it/abc',
  ])('erlaubt %s', (url) => expect(parseSafeUrl(url)).not.toBeNull())

  it.each([
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'http://localhost:54321/rest',
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://0x7f.1/',
    'http://10.0.0.5/',
    'http://169.254.169.254/latest/meta-data/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://[::1]/',
    'http://db.internal/',
    'http://router/',
    'https://example.com:8443/',
    'https://nutzer:passwort@example.com/',
    'kein link',
  ])('blockt %s', (url) => expect(parseSafeUrl(url)).toBeNull())

  it('loest relative Bildpfade auf', () => {
    expect(parseSafeUrl('/bild.jpg', 'https://example.com/rezept/1')?.href).toBe('https://example.com/bild.jpg')
  })
})

describe('isPrivateIp', () => {
  it.each(['10.1.1.1', '127.0.0.1', '169.254.1.1', '172.31.0.1', '192.168.0.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])(
    '%s ist intern',
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  )
  it.each(['8.8.8.8', '172.32.0.1', '151.101.1.1', '2606:4700::1111'])('%s ist oeffentlich', (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  )
})

describe('metaContent', () => {
  it('findet Tags unabhaengig von der Attribut-Reihenfolge', () => {
    const html = `<meta content="Omas K&auml;se" property="og:title"><meta name='description' content='Lecker'>`
    expect(metaContent(html, ['og:title'])).toBe('Omas Käse')
    expect(metaContent(html, ['og:description', 'description'])).toBe('Lecker')
    expect(metaContent(html, ['og:image'])).toBeNull()
  })
})

describe('findJsonLdRecipe', () => {
  const wrap = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`

  it('liest ein Rezept direkt', () => {
    const html = wrap({
      '@type': 'Recipe',
      name: 'Pesto &amp; Pasta',
      recipeIngredient: ['200 g Nudeln'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Kochen.' }],
      image: ['https://example.com/a.jpg'],
    })
    expect(findJsonLdRecipe(html)).toMatchObject({
      name: 'Pesto & Pasta',
      recipeIngredient: ['200 g Nudeln'],
      recipeInstructions: ['Kochen.'],
      imageUrl: 'https://example.com/a.jpg',
    })
  })

  it('findet es in @graph und bei mehreren Typen', () => {
    const html = wrap({ '@graph': [{ '@type': 'WebSite' }, { '@type': ['Recipe', 'Thing'], name: 'Suppe' }] })
    expect(findJsonLdRecipe(html)?.name).toBe('Suppe')
  })

  it('flacht verschachtelte Anleitungen ab', () => {
    const html = wrap({
      '@type': 'Recipe',
      recipeInstructions: [{ '@type': 'HowToSection', itemListElement: [{ text: 'Eins' }, { text: 'Zwei' }] }],
    })
    expect(findJsonLdRecipe(html)?.recipeInstructions).toEqual(['Eins', 'Zwei'])
  })

  it('uebersteht kaputtes JSON und Seiten ohne Rezept', () => {
    expect(findJsonLdRecipe('<script type="application/ld+json">{kaputt</script>')).toBeNull()
    expect(findJsonLdRecipe(wrap({ '@type': 'Article' }))).toBeNull()
    expect(findJsonLdRecipe('<p>nichts</p>')).toBeNull()
  })
})

describe('findTikTokPost', () => {
  const page = (scope: unknown) =>
    `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: scope })}</script></html>`
  const item = {
    desc: 'Tikka Masala: 400 g Tofu #rezept',
    author: { nickname: 'Koch', uniqueId: 'koch1' },
    video: {
      cover: 'https://cdn.example/c.jpg',
      originCover: 'https://cdn.example/o.jpg',
      subtitleInfos: [{ Url: 'https://cdn.example/de.vtt', LanguageCodeName: 'deu-DE' }, { Format: 'ohne url' }],
    },
  }

  it('liest die Desktop-Variante', () => {
    expect(findTikTokPost(page({ 'webapp.video-detail': { itemInfo: { itemStruct: item } } }))).toEqual({
      description: 'Tikka Masala: 400 g Tofu #rezept',
      author: 'Koch',
      coverUrl: 'https://cdn.example/o.jpg',
      subtitles: [{ url: 'https://cdn.example/de.vtt', language: 'deu-de' }],
    })
  })

  it('liest die Mobil-Variante', () => {
    expect(findTikTokPost(page({ 'webapp.reflow.video.detail': { itemInfo: { itemStruct: item } } }))?.description).toContain('Tofu')
  })

  it('versteht Foto-Beitraege', () => {
    const photo = {
      desc: 'Rezept',
      contents: [{ desc: 'Rezept' }, { desc: '200 g Mehl' }],
      imagePost: { images: [{ imageURL: { urlList: ['https://cdn.example/1.jpg'] } }] },
    }
    expect(findTikTokPost(page({ 'webapp.video-detail': { itemInfo: { itemStruct: photo } } }))).toMatchObject({
      description: 'Rezept\n200 g Mehl',
      coverUrl: 'https://cdn.example/1.jpg',
      subtitles: [],
    })
  })

  it('gibt null zurueck, wenn nichts Passendes da ist', () => {
    expect(findTikTokPost('<html>nichts</html>')).toBeNull()
    expect(findTikTokPost(page({ 'webapp.app-context': {} }))).toBeNull()
    expect(findTikTokPost('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{kaputt</script>')).toBeNull()
  })
})

describe('parseAmount', () => {
  it.each([
    ['8', 8],
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['½', 0.5],
    ['1½', 1.5],
    ['1 ½', 1.5],
  ])('%s ist %d', (text, value) => expect(parseAmount(text)).toBe(value))

  it.each(['1-2', 'etwas', '', '1/0'])('„%s“ ist keine eindeutige Menge', (text) => expect(parseAmount(text)).toBeNull())
  it('kommt mit null zurecht', () => expect(parseAmount(null)).toBeNull())
})

describe('exactMetric', () => {
  it.each([
    ['8', 'oz', '≈ 225 g'],
    ['1', 'lb', '≈ 455 g'],
    ['2', 'lbs', '≈ 905 g'],
    ['1/2', 'pound', '≈ 225 g'],
    ['4', 'ounces', '≈ 115 g'],
    ['1', 'oz', '≈ 30 g'],
    ['8', 'fl oz', '≈ 235 ml'],
    ['0.5', 'oz', '≈ 14 g'],
  ])('%s %s wird %s', (quantity, unit, expected) => expect(exactMetric(quantity, unit)).toBe(expected))

  it('rechnet nichts ohne festen Faktor oder eindeutige Menge', () => {
    expect(exactMetric('1', 'cup')).toBeNull()
    expect(exactMetric('1-2', 'oz')).toBeNull()
    expect(exactMetric('1', null)).toBeNull()
  })
})

describe('firstUsable', () => {
  it('hoert beim ersten brauchbaren Ergebnis auf', async () => {
    const calls: number[] = []
    const result = await firstUsable(async (index) => (calls.push(index), index), (value) => value === 1, 3, 0)
    expect(result).toBe(1)
    expect(calls).toEqual([0, 1])
  })

  it('gibt nach den Versuchen das letzte Ergebnis zurueck', async () => {
    let calls = 0
    const result = await firstUsable(async () => (++calls, null), (value) => value !== null, 3, 0)
    expect(result).toBeNull()
    expect(calls).toBe(3)
  })

  it('braucht beim ersten Treffer keinen zweiten Versuch', async () => {
    let calls = 0
    await firstUsable(async () => ++calls, () => true, 3, 0)
    expect(calls).toBe(1)
  })
})

describe('Untertitel', () => {
  it('bevorzugt Deutsch, dann Englisch', () => {
    const fr = { url: 'fr', language: 'fra-fr' }
    const en = { url: 'en', language: 'eng-us' }
    const de = { url: 'de', language: 'deu-de' }
    expect(pickSubtitle([fr, en, de])).toBe('de')
    expect(pickSubtitle([fr, en])).toBe('en')
    expect(pickSubtitle([fr])).toBe('fr')
    expect(pickSubtitle([])).toBeNull()
  })

  it('macht aus WebVTT reinen Text', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nNimm 400 g Tofu\n\n00:00:02.000 --> 00:00:03.000\nNimm 400 g Tofu\n\n00:00:03.000 --> 00:00:04.000\n<c>und Salz &amp; Pfeffer</c>\n'
    expect(vttToText(vtt)).toBe('Nimm 400 g Tofu und Salz & Pfeffer')
  })
})

describe('htmlToText', () => {
  it('entfernt Skripte und Tags', () => {
    const text = htmlToText('<style>a{}</style><p>200 g <b>Mehl</b></p><script>alert(1)</script><li>Salz &amp; Pfeffer</li>')
    expect(text).toBe('200 g Mehl\nSalz & Pfeffer')
  })
})

describe('decodeEntities', () => {
  it('versteht benannte und numerische Entitaeten', () => {
    expect(decodeEntities('K&uuml;che &#228; &#xE4; &unbekannt;')).toBe('Küche ä ä &unbekannt;')
  })
})

describe('normalizeDraft', () => {
  const categories = [{ id: 'c1', name: 'Abendessen' }]
  const base = {
    title: ' Pasta ',
    description: '  ',
    servings: 0,
    total_minutes: 19.6,
    category: 'abendessen',
    tags: ['schnell', 'Schnell', ' ', 'veggie'],
    ingredients: [{ name: ' Nudeln ', quantity: ' 200 ', unit: '' }, { name: ' ', quantity: null, unit: null }],
    steps: [' Kochen. ', ''],
  }

  it('bereinigt die Antwort', () => {
    expect(normalizeDraft(base, categories, 'Fallback')).toEqual({
      title: 'Pasta',
      description: null,
      servings: null,
      total_minutes: 20,
      category_id: 'c1',
      tags: ['schnell', 'veggie'],
      ingredients: [{ name: 'Nudeln', quantity: '200', unit: null, metric: null }],
      steps: ['Kochen.'],
    })
  })

  describe('Umrechnung', () => {
    const one = (item: { quantity: string | null; unit: string | null; metric?: string | null }) =>
      normalizeDraft({ ...base, ingredients: [{ name: 'Mehl', ...item }] }, categories, 'X').ingredients[0]

    it('behaelt bei Cups die Originalangabe und die Schaetzung der KI', () => {
      expect(one({ quantity: '1', unit: 'cup', metric: '120 g' })).toEqual({ name: 'Mehl', quantity: '1', unit: 'cup', metric: '≈ 120 g' })
    })

    it('verdoppelt das Ungefaehr-Zeichen nicht', () => {
      expect(one({ quantity: '1', unit: 'cup', metric: '≈ 120 g' }).metric).toBe('≈ 120 g')
      expect(one({ quantity: '1', unit: 'cup', metric: 'ca. 120 g' }).metric).toBe('≈ 120 g')
    })

    it('rechnet Gewichte selbst, auch gegen die Angabe der KI', () => {
      expect(one({ quantity: '8', unit: 'oz', metric: '999 g' }).metric).toBe('≈ 225 g')
    })

    it('rechnet Metrisches nicht um', () => {
      expect(one({ quantity: '200', unit: 'g', metric: '≈ 200 g' }).metric).toBeNull()
      expect(one({ quantity: '1', unit: 'L', metric: '1000 ml' }).metric).toBeNull()
    })

    it('laesst leere Angaben leer', () => {
      expect(one({ quantity: '2', unit: 'EL', metric: null }).metric).toBeNull()
      expect(one({ quantity: '1', unit: 'Prise' }).metric).toBeNull()
    })
  })

  it('ignoriert erfundene Kategorien und nutzt notfalls den Ersatztitel', () => {
    const draft = normalizeDraft({ ...base, title: ' ', category: 'Gibt es nicht' }, categories, 'Fallback')
    expect(draft.category_id).toBeNull()
    expect(draft.title).toBe('Fallback')
  })
})
