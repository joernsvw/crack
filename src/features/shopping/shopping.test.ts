import { describe, expect, it } from 'vitest'
import type { ShoppingItem } from '../../lib/types'
import { parseQuickInput, suggestCategory } from './catalog'
import { applyOps } from './outbox'

describe('parseQuickInput', () => {
  it('trennt an Kommas und Zeilen', () => {
    expect(parseQuickInput('Milch, Eier\nButter').map((item) => item.name)).toEqual(['Milch', 'Eier', 'Butter'])
  })

  it('liest Menge und Einheit', () => {
    expect(parseQuickInput('500 g Hackfleisch')).toEqual([{ name: 'Hackfleisch', quantity: '500', unit: 'g' }])
    expect(parseQuickInput('500g Hack')).toEqual([{ name: 'Hack', quantity: '500', unit: 'g' }])
    expect(parseQuickInput('3 Paprika')).toEqual([{ name: 'Paprika', quantity: '3', unit: null }])
  })

  it('trennt nicht innerhalb einer Dezimalzahl', () => {
    expect(parseQuickInput('1,5 kg Mehl, Milch')).toEqual([
      { name: 'Mehl', quantity: '1,5', unit: 'kg' },
      { name: 'Milch', quantity: null, unit: null },
    ])
  })

  it('trennt auch ohne Leerzeichen vor einer Zahl', () => {
    expect(parseQuickInput('Milch,2 Eier').map((item) => item.name)).toEqual(['Milch', 'Eier'])
  })

  it('ignoriert Leereintraege und Aufzaehlungszeichen', () => {
    expect(parseQuickInput(' , \n- Salz\n\n').map((item) => item.name)).toEqual(['Salz'])
  })

  it('behandelt eine Zahl im Namen nicht als Einheit', () => {
    expect(parseQuickInput('7up')).toEqual([{ name: '7up', quantity: null, unit: null }])
  })
})

describe('suggestCategory', () => {
  it.each([
    ['Tomaten', 'Obst & Gemüse'],
    ['Tomatenmark', 'Trockenwaren'],
    ['Kartoffelchips', 'Trockenwaren'],
    ['Kartoffeln', 'Obst & Gemüse'],
    ['Reibekäse', 'Kühlregal'],
    ['Halloumi', 'Kühlregal'],
    ['Milch', 'Kühlregal'],
    ['Vollkornbrot', 'Brot'],
    ['Reis', 'Trockenwaren'],
    ['Eis', 'Tiefkühl'],
    ['Eier', 'Kühlregal'],
    ['Tiefkühlpizza', 'Tiefkühl'],
    ['Zahnpasta', 'Drogerie'],
    ['Glasreiniger', 'Drogerie'],
    ['Preiselbeeren', 'Obst & Gemüse'],
    ['Geschenkband', 'Sonstiges'],
  ])('%s -> %s', (name, category) => {
    expect(suggestCategory(name)).toBe(category)
  })
})

describe('applyOps', () => {
  const item = (id: string, extra: Partial<ShoppingItem> = {}): ShoppingItem => ({
    id,
    household_id: 'h',
    name: id,
    quantity: null,
    unit: null,
    category: 'Sonstiges',
    checked: false,
    checked_at: null,
    created_by: null,
    created_at: '2026-01-01',
    ...extra,
  })

  it('zeigt offline angelegte Eintraege zusaetzlich zum Serverstand', () => {
    const result = applyOps([item('a')], [{ kind: 'insert', rows: [item('b')] }])
    expect(result.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('verdoppelt nichts, wenn der Server den Eintrag schon kennt', () => {
    const result = applyOps([item('a')], [{ kind: 'insert', rows: [item('a')] }])
    expect(result).toHaveLength(1)
  })

  it('behaelt Abhaken ueber eine Aktualisierung vom Server hinweg', () => {
    const result = applyOps([item('a', { name: 'Neu vom Partner' })], [{ kind: 'update', id: 'a', patch: { checked: true } }])
    expect(result[0]).toMatchObject({ checked: true, name: 'Neu vom Partner' })
  })

  it('wendet Aenderungen der Reihe nach an', () => {
    const result = applyOps(
      [],
      [
        { kind: 'insert', rows: [item('a')] },
        { kind: 'update', id: 'a', patch: { checked: true } },
        { kind: 'delete', ids: ['a'] },
      ],
    )
    expect(result).toEqual([])
  })

  it('stolpert nicht ueber einen Eintrag, den die andere Person geloescht hat', () => {
    const result = applyOps([], [{ kind: 'update', id: 'weg', patch: { checked: true } }])
    expect(result).toEqual([])
  })
})
