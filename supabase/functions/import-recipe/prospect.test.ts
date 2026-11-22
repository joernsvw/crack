import { describe, expect, it } from 'vitest'
import { mapLimit, normalizeOffers, pickValidity, validDate, type ModelOffer, duplicateOfferIds, offerKey } from './prospect'

const offer = (extra: Partial<ModelOffer> = {}): ModelOffer => ({
  name: ' Hähnchen-Brustfilets ',
  brand: 'Gut Ponholz',
  quantity: '600 g',
  price: 4.99,
  original_price: 6.49,
  base_price: '1 kg = 8,32',
  condition: null,
  valid_from: '2026-11-24',
  valid_to: '2026-11-29',
  page: 3,
  ...extra,
})

describe('validDate', () => {
  it('akzeptiert nur echte Kalenderdaten', () => {
    expect(validDate('2026-11-24')).toBe('2026-11-24')
    expect(validDate('2026-02-30')).toBeNull()
    expect(validDate('24.11.2026')).toBeNull()
    expect(validDate(null)).toBeNull()
  })
})

describe('normalizeOffers', () => {
  it('bereinigt ein Angebot', () => {
    expect(normalizeOffers([{ valid_from: null, valid_to: null, offers: [offer()] }])).toEqual([
      {
        name: 'Hähnchen-Brustfilets',
        brand: 'Gut Ponholz',
        quantity: '600 g',
        price: 4.99,
        original_price: 6.49,
        base_price: '1 kg = 8,32',
        condition: null,
        valid_from: '2026-11-24',
        valid_to: '2026-11-29',
        page: 3,
      },
    ])
  })

  it('verwirft Angebote ohne Namen oder mit unbrauchbarem Preis', () => {
    const offers = [offer({ name: ' ' }), offer({ price: -1 }), offer({ price: Number.NaN }), offer({ price: 99999 })]
    expect(normalizeOffers([{ valid_from: null, valid_to: null, offers }])).toEqual([])
  })

  it('entfernt Doppelte ueber mehrere Teile hinweg', () => {
    const results = [
      { valid_from: null, valid_to: null, offers: [offer()] },
      { valid_from: null, valid_to: null, offers: [offer({ name: 'hähnchen-brustfilets', page: 7 }), offer({ quantity: '1 kg' })] },
    ]
    expect(normalizeOffers(results).map((entry) => entry.quantity)).toEqual(['600 g', '1 kg'])
  })

  it('ignoriert einen vorherigen Preis, der nicht hoeher ist, und ungueltige Daten', () => {
    const [cleaned] = normalizeOffers([{ valid_from: null, valid_to: null, offers: [offer({ original_price: 3, valid_to: '29.11.', page: 0 })] }])
    expect(cleaned).toMatchObject({ original_price: null, valid_to: null, page: null })
  })

  it('rundet Preise auf Cent', () => {
    expect(normalizeOffers([{ valid_from: null, valid_to: null, offers: [offer({ price: 1.999 })] }])[0].price).toBe(2)
  })
})

describe('pickValidity', () => {
  it('nimmt das haeufigste Datum', () => {
    const results = [
      { valid_from: '2026-11-24', valid_to: '2026-11-29', offers: [] },
      { valid_from: '2026-11-24', valid_to: '2026-11-29', offers: [] },
      { valid_from: '2026-11-27', valid_to: null, offers: [] },
    ]
    expect(pickValidity(results)).toEqual({ valid_from: '2026-11-24', valid_to: '2026-11-29' })
  })

  it('kommt ohne Angaben zurecht und verwirft ein Ende vor dem Anfang', () => {
    expect(pickValidity([{ valid_from: null, valid_to: null, offers: [] }])).toEqual({ valid_from: null, valid_to: null })
    expect(pickValidity([{ valid_from: '2026-11-29', valid_to: '2026-11-24', offers: [] }])).toEqual({ valid_from: '2026-11-29', valid_to: null })
  })
})

describe('mapLimit', () => {
  it('haelt die Reihenfolge und die Grenze ein', async () => {
    let running = 0
    let peak = 0
    const result = await mapLimit([30, 10, 20, 5], 2, async (wait, index) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, wait))
      running--
      return index
    })
    expect(result).toEqual([0, 1, 2, 3])
    expect(peak).toBe(2)
  })
})

describe('duplicateOfferIds', () => {
  it('behaelt das erste und meldet Doppelte ueber Teile hinweg', () => {
    const rows = [
      { id: 'a', name: 'Tomaten', quantity: '1 kg', price: 1.29 },
      { id: 'b', name: 'tomaten ', quantity: '1 KG', price: 1.29 },
      { id: 'c', name: 'Tomaten', quantity: '500 g', price: 1.29 },
    ]
    expect(duplicateOfferIds(rows)).toEqual(['b'])
    expect(offerKey(rows[0])).toBe('tomaten|1 kg|1.29')
  })
})
