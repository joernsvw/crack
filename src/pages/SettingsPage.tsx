import { useEffect, useState, type FormEvent } from 'react'
import { Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { ErrorBox, PageHeader } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useCategories } from '../features/recipes/data'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/types'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { household, members, householdId, reload } = useHousehold()
  const own = members.find((member) => member.user_id === user?.id)
  const [name, setName] = useState(own?.display_name ?? '')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const { error: updateError } = await supabase
      .from('household_members')
      .update({ display_name: name.trim() })
      .eq('household_id', householdId)
      .eq('user_id', user!.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await reload()
    setSaved(true)
  }

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [saved])

  const copyCode = async () => {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="pb-10">
      <PageHeader title="Einstellungen" back={true} />
      <main className="mx-auto max-w-2xl space-y-8 px-4 pt-2">
        <section>
          <h2 className="mb-2 font-bold">Dein Profil</h2>
          <form className="flex gap-2" onSubmit={saveName}>
            <input
              className="input"
              aria-label="Dein Name"
              required
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="btn btn-soft">{saved ? <Check size={20} aria-label="Gespeichert" /> : 'Speichern'}</button>
          </form>
          <p className="mt-1 text-sm text-muted">Angemeldet als {user?.email}</p>
          {error && <div className="mt-2"><ErrorBox message={error} /></div>}
        </section>

        <section>
          <h2 className="mb-2 font-bold">Haushalt</h2>
          <ul className="card divide-y divide-line">
            {members.map((member) => (
              <li key={member.user_id} className="px-4 py-3">
                {member.display_name}
              </li>
            ))}
          </ul>
          {members.length < household.max_members && (
            <div className="mt-3">
              <p className="text-sm text-muted">Einladungscode für die zweite Person:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="card min-w-0 flex-1 overflow-x-auto px-3 py-2.5 text-sm">{household.invite_code}</code>
                <button className="icon-btn" aria-label="Code kopieren" onClick={() => void copyCode()}>
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </div>
          )}
        </section>

        <CategoryManager householdId={householdId} />

        <section>
          <button className="btn btn-danger w-full" onClick={() => void signOut()}>
            Abmelden
          </button>
        </section>
      </main>
    </div>
  )
}

function CategoryManager({ householdId }: { householdId: string }) {
  const { data: categories, refresh } = useCategories(householdId)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = async (action: PromiseLike<{ error: { code?: string; message: string } | null }>) => {
    setError(null)
    const { error: actionError } = await action
    if (actionError) {
      setError(actionError.code === '23505' ? 'Diese Kategorie gibt es schon.' : actionError.message)
      return false
    }
    await refresh()
    return true
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    const sortOrder = Math.max(0, ...(categories ?? []).map((category) => category.sort_order)) + 1
    const ok = await run(
      supabase.from('categories').insert({ household_id: householdId, name: newName.trim(), sort_order: sortOrder }),
    )
    if (ok) setNewName('')
  }

  const rename = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const ok = await run(supabase.from('categories').update({ name: editName.trim() }).eq('id', editing.id))
    if (ok) setEditing(null)
  }

  const remove = async (category: Category) => {
    if (!window.confirm(`Kategorie „${category.name}“ löschen? Die Rezepte bleiben erhalten, nur ohne Kategorie.`)) return
    await run(supabase.from('categories').delete().eq('id', category.id))
  }

  return (
    <section>
      <h2 className="mb-2 font-bold">Rezept-Kategorien</h2>
      <ul className="card divide-y divide-line">
        {(categories ?? []).map((category) => (
          <li key={category.id} className="flex items-center gap-1 pl-4 pr-1">
            {editing?.id === category.id ? (
              <form className="flex flex-1 items-center gap-2 py-1.5" onSubmit={rename}>
                <input
                  className="input"
                  aria-label="Neuer Name"
                  autoFocus
                  required
                  maxLength={60}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
                <button className="icon-btn text-primary" aria-label="Speichern">
                  <Check size={20} />
                </button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate py-3">{category.name}</span>
                <button
                  className="icon-btn"
                  aria-label={`${category.name} umbenennen`}
                  onClick={() => {
                    setEditing(category)
                    setEditName(category.name)
                  }}
                >
                  <Pencil size={18} />
                </button>
                <button className="icon-btn" aria-label={`${category.name} löschen`} onClick={() => void remove(category)}>
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="mt-2 flex gap-2" onSubmit={add}>
        <input
          className="input"
          placeholder="Neue Kategorie"
          aria-label="Neue Kategorie"
          required
          maxLength={60}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button className="btn btn-soft" aria-label="Kategorie hinzufügen">
          <Plus size={20} />
        </button>
      </form>
      {error && <div className="mt-2"><ErrorBox message={error} /></div>}
    </section>
  )
}
