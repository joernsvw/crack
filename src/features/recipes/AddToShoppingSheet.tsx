import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Sheet, Spinner } from '../../components/ui'
import type { Ingredient } from '../../lib/types'
import { useShopping } from '../shopping/useShopping'
import { prepareSelection, type IngredientHint } from './shoppingSelection'

const MAX_WAIT = 2500

const HINT_TEXT: Record<Exclude<IngredientHint, null>, string> = {
  'on-list': 'steht schon auf der Liste',
  staple: 'meist zu Hause',
}

export function AddToShoppingSheet({
  householdId,
  userId,
  ingredients,
  onClose,
  onAdded,
}: {
  householdId: string
  userId: string
  ingredients: Ingredient[]
  onClose: () => void
  onAdded: (count: number) => void
}) {
  // Ueber die Warteschlange der Einkaufsliste, so klappt das Hinzufuegen auch offline.
  const shopping = useShopping(householdId, userId)
  // Kurz auf den aktuellen Stand warten, sonst fehlt, was die andere Person gerade eingetragen hat.
  // Bei schlechtem Netz geht es nach kurzer Zeit mit dem gespeicherten Stand weiter.
  const [waited, setWaited] = useState(!navigator.onLine)
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), MAX_WAIT)
    return () => clearTimeout(timer)
  }, [])

  if (!shopping.settled && !waited) {
    return (
      <Sheet title="Auf die Einkaufsliste" onClose={onClose}>
        <Spinner />
      </Sheet>
    )
  }
  return <Selection shopping={shopping} ingredients={ingredients} onClose={onClose} onAdded={onAdded} />
}

function Selection({
  shopping,
  ingredients,
  onClose,
  onAdded,
}: {
  shopping: ReturnType<typeof useShopping>
  ingredients: Ingredient[]
  onClose: () => void
  onAdded: (count: number) => void
}) {
  // Nur beim Oeffnen berechnen: Eine spaetere Aenderung der Liste soll die Haekchen nicht verstellen.
  const [rows, setRows] = useState(() => prepareSelection(ingredients, shopping.items))
  const count = rows.filter((row) => row.selected).length

  const toggle = (index: number) =>
    setRows(rows.map((row, position) => (position === index ? { ...row, selected: !row.selected } : row)))

  const add = () => {
    shopping.add(
      rows
        .filter((row) => row.selected)
        // Im Supermarkt hilft "≈ 120 g" mehr als "1 cup".
        .map(({ ingredient }) =>
          ingredient.metric
            ? { name: ingredient.name, quantity: ingredient.metric, unit: null }
            : { name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit },
        ),
    )
    onAdded(count)
  }

  return (
    <Sheet title="Auf die Einkaufsliste" onClose={onClose}>
      <p className="text-sm text-muted">Nimm raus, was ihr schon zu Hause habt.</p>
      <ul className="mt-2 divide-y divide-line">
        {rows.map(({ ingredient, hint, selected }, index) => (
          <li key={`${ingredient.name}-${index}`}>
            <button
              className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(index)}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                  selected ? 'border-primary bg-primary text-primary-ink' : 'border-muted/50'
                }`}
              >
                {selected && <Check size={16} strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words">{ingredient.name}</span>
                {hint && <span className="block text-xs text-muted">{HINT_TEXT[hint]}</span>}
              </span>
              <span className="shrink-0 text-right text-sm text-muted">
                {[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')}
                {ingredient.metric && <span className="block">{ingredient.metric}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-primary mt-3 w-full" disabled={count === 0} onClick={add}>
        {count === 0 ? 'Nichts ausgewählt' : count === 1 ? '1 Zutat hinzufügen' : `${count} Zutaten hinzufügen`}
      </button>
    </Sheet>
  )
}
