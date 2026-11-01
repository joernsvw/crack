import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, ChevronDown, CloudOff, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { EmptyState, ErrorBox, MemberInitial, PageHeader, Sheet, Spinner } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useHousehold } from '../../context/HouseholdContext'
import type { ShoppingItem } from '../../lib/types'
import { parseQuickInput, SHOPPING_CATEGORIES } from './catalog'
import { useShopping } from './useShopping'

function amount(item: ShoppingItem) {
  return [item.quantity, item.unit].filter(Boolean).join(' ')
}

export function ShoppingPage() {
  const { user } = useAuth()
  const { householdId, memberName } = useHousehold()
  const shopping = useShopping(householdId, user!.id)
  const { items, loading, error, online, pending } = shopping
  const [input, setInput] = useState('')
  const [editing, setEditing] = useState<ShoppingItem | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)

  const open = useMemo(() => items.filter((item) => !item.checked), [items])
  const done = useMemo(
    () => items.filter((item) => item.checked).sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? '')),
    [items],
  )
  const groups = useMemo(() => {
    const known: readonly string[] = SHOPPING_CATEGORIES
    return SHOPPING_CATEGORIES.map((category) => ({
      category,
      items: open.filter((item) =>
        category === 'Sonstiges' ? !known.includes(item.category) || item.category === category : item.category === category,
      ),
    })).filter((group) => group.items.length > 0)
  }, [open])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const parsed = parseQuickInput(input)
    if (parsed.length === 0) return
    shopping.add(parsed)
    setInput('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const clearDone = () => {
    if (window.confirm(`${done.length} erledigte Einträge löschen?`)) {
      shopping.remove(done.map((item) => item.id))
    }
  }

  const row = (item: ShoppingItem) => (
    <li key={item.id} className="flex items-center gap-1 pr-3">
      <button
        className="flex h-12 w-12 shrink-0 items-center justify-center"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={`${item.name} ${item.checked ? 'wieder öffnen' : 'abhaken'}`}
        onClick={() => shopping.toggle(item)}
      >
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            item.checked ? 'border-primary bg-primary text-primary-ink' : 'border-muted/50'
          }`}
        >
          {item.checked && <Check size={16} strokeWidth={3} />}
        </span>
      </button>
      <button className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 text-left" onClick={() => setEditing(item)}>
        <span className={`min-w-0 flex-1 break-words ${item.checked ? 'text-muted line-through' : ''}`}>{item.name}</span>
        {amount(item) && <span className="shrink-0 text-sm text-muted">{amount(item)}</span>}
      </button>
      <MemberInitial name={memberName(item.created_by)} />
    </li>
  )

  return (
    <>
      <PageHeader title="Einkauf" settings />
      <main className="mx-auto max-w-2xl px-4">
        <form className="flex items-start gap-2" onSubmit={submit}>
          <textarea
            className="input resize-none"
            rows={input.includes('\n') ? 4 : 1}
            placeholder="z. B. 2 Paprika, 500 g Hack, Milch"
            aria-label="Artikel hinzufügen"
            enterKeyHint="done"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="btn btn-primary w-11 shrink-0 !p-0" aria-label="Hinzufügen" disabled={!input.trim()}>
            <Plus size={24} />
          </button>
        </form>

        {!online && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
            <CloudOff size={16} className="shrink-0" />
            Du bist offline. {pending > 0 ? `${pending} Änderungen werden später synchronisiert.` : 'Änderungen werden später synchronisiert.'}
          </p>
        )}
        {error && (
          <div className="mt-3">
            <ErrorBox message={error} onRetry={shopping.clearError} />
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Die Liste ist leer" text="Tippe oben ein, was ihr braucht. Mehrere Artikel trennst du mit Kommas." />
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map((group) => (
              <section key={group.category}>
                <h2 className="mb-1 px-1 text-sm font-semibold text-muted">{group.category}</h2>
                <ul className="card divide-y divide-line">{group.items.map(row)}</ul>
              </section>
            ))}
            {open.length === 0 && <p className="py-6 text-center text-muted">Alles erledigt!</p>}

            {done.length > 0 && (
              <section>
                <div className="flex items-center justify-between">
                  <button
                    className="flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-muted"
                    aria-expanded={doneOpen}
                    onClick={() => setDoneOpen(!doneOpen)}
                  >
                    <ChevronDown size={18} className={`transition-transform ${doneOpen ? '' : '-rotate-90'}`} />
                    Erledigt ({done.length})
                  </button>
                  <button className="flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-danger" onClick={clearDone}>
                    <Trash2 size={16} />
                    Erledigte löschen
                  </button>
                </div>
                {doneOpen && <ul className="card fade-in divide-y divide-line">{done.map(row)}</ul>}
              </section>
            )}
          </div>
        )}
      </main>

      {editing && (
        <EditSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            shopping.update(editing.id, patch)
            setEditing(null)
          }}
          onDelete={() => {
            shopping.remove([editing.id])
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function EditSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ShoppingItem
  onClose: () => void
  onSave: (patch: Partial<ShoppingItem>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(item.name)
  const [quantity, setQuantity] = useState(item.quantity ?? '')
  const [unit, setUnit] = useState(item.unit ?? '')
  const [category, setCategory] = useState(item.category)

  const save = (event: FormEvent) => {
    event.preventDefault()
    onSave({ name: name.trim(), quantity: quantity.trim() || null, unit: unit.trim() || null, category })
  }

  return (
    <Sheet title="Eintrag bearbeiten" onClose={onClose}>
      <form className="space-y-4" onSubmit={save}>
        <div>
          <label className="label" htmlFor="item-name">
            Name
          </label>
          <input id="item-name" className="input" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="item-quantity">
              Menge
            </label>
            <input id="item-quantity" className="input" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="item-unit">
              Einheit
            </label>
            <input id="item-unit" className="input" value={unit} onChange={(event) => setUnit(event.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="item-category">
            Kategorie
          </label>
          <select id="item-category" className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
            {SHOPPING_CATEGORIES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-danger" aria-label="Eintrag löschen" onClick={onDelete}>
            <Trash2 size={20} />
          </button>
          <button className="btn btn-primary flex-1">Speichern</button>
        </div>
      </form>
    </Sheet>
  )
}
