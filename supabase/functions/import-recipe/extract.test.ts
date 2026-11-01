import { describe, expect, it } from 'vitest'
import {
  decodeEntities,
  findJsonLdRecipe,
  htmlToText,
  isPrivateIp,
  metaContent,
  normalizeDraft,
  parseSafeUrl,
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
      ingredients: [{ name: 'Nudeln', quantity: '200', unit: null }],
      steps: ['Kochen.'],
    })
  })

  it('ignoriert erfundene Kategorien und nutzt notfalls den Ersatztitel', () => {
    const draft = normalizeDraft({ ...base, title: ' ', category: 'Gibt es nicht' }, categories, 'Fallback')
    expect(draft.category_id).toBeNull()
    expect(draft.title).toBe('Fallback')
  })
})
