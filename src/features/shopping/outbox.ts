import type { ShoppingItem } from '../../lib/types'

/** Eine Aenderung, die noch zum Server muss. Felder einzeln, damit parallele Aenderungen sich nicht ueberschreiben. */
export type Op =
  | { kind: 'insert'; rows: ShoppingItem[] }
  | { kind: 'update'; id: string; patch: Partial<ShoppingItem> }
  | { kind: 'delete'; ids: string[] }

/** Legt die noch offenen Aenderungen ueber den Stand vom Server. */
export function applyOps(items: ShoppingItem[], ops: Op[]): ShoppingItem[] {
  return ops.reduce((current, op) => {
    switch (op.kind) {
      case 'insert': {
        const known = new Set(current.map((item) => item.id))
        return [...current, ...op.rows.filter((row) => !known.has(row.id))]
      }
      case 'update':
        return current.map((item) => (item.id === op.id ? { ...item, ...op.patch } : item))
      case 'delete': {
        const removed = new Set(op.ids)
        return current.filter((item) => !removed.has(item.id))
      }
    }
  }, items)
}
