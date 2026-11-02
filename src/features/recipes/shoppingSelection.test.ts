import { describe, expect, it } from 'vitest'
import type { Ingredient, ShoppingItem } from '../../lib/types'
import { prepareSelection } from './shoppingSelection'

const ingredient = (name: string): Ingredient => ({ name, quantity: null, unit: null, sort_order: 0 })
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

describe('prepareSelection', () => {
  it('waehlt normale Zutaten vor', () => {
    expect(prepareSelection([ingredient('Nudeln')], [])[0]).toMatchObject({ hint: null, selected: true })
  })

  it('waehlt nicht vor, was schon auf der Liste steht, auch in anderer Schreibweise', () => {
    expect(prepareSelection([ingredient('Tomaten')], [item('Tomate')])[0]).toMatchObject({ hint: 'on-list', selected: false })
  })

  it('zaehlt abgehakte Eintraege nicht als vorhanden', () => {
    expect(prepareSelection([ingredient('Tomaten')], [item('Tomaten', true)])[0]).toMatchObject({ hint: null, selected: true })
  })

  it('waehlt Grundzutaten nicht vor', () => {
    expect(prepareSelection([ingredient(' Salz '), ingredient('Olivenöl')], []).map((entry) => entry.hint)).toEqual(['staple', 'staple'])
  })

  it('verwechselt Salzkartoffeln nicht mit Salz', () => {
    expect(prepareSelection([ingredient('Salzkartoffeln')], [])[0].selected).toBe(true)
  })
})
