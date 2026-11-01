import { useMemo, useState } from 'react'
import { Pin, Plus, Search, StickyNote } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useHousehold } from '../../context/HouseholdContext'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { formatRelativeDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Note } from '../../lib/types'

export function NotesPage() {
  const { householdId, memberName } = useHousehold()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const { data, loading, error, refresh } = useLiveQuery<Note[]>({
    householdId,
    key: 'notes',
    tables: ['notes'],
    fetcher: async () => {
      const { data: rows, error: fetchError } = await supabase
        .from('notes')
        // Inhalt erst im Editor laden, die Liste braucht nur Titel und Vorschau.
        .select('id, household_id, title, preview, pinned, updated_by, updated_at')
        .eq('household_id', householdId)
        .order('updated_at', { ascending: false })
      if (fetchError) throw fetchError
      return rows as Note[]
    },
  })

  const notes = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matching = (data ?? []).filter(
      (note) => !term || note.title.toLowerCase().includes(term) || note.preview.toLowerCase().includes(term),
    )
    return { pinned: matching.filter((note) => note.pinned), other: matching.filter((note) => !note.pinned) }
  }, [data, search])

  const create = async () => {
    setCreateError(null)
    const { data: note, error: insertError } = await supabase
      .from('notes')
      .insert({ household_id: householdId })
      .select('id')
      .single()
    if (insertError) {
      setCreateError(navigator.onLine ? insertError.message : 'Neue Notizen brauchen eine Internetverbindung.')
      return
    }
    navigate(`/notizen/${note.id}`)
  }

  const row = (note: Note) => {
    const author = memberName(note.updated_by)
    return (
      <li key={note.id}>
        <Link to={`/notizen/${note.id}`} className="block px-4 py-3">
          <span className="flex items-center gap-1.5 font-semibold">
            {note.pinned && <Pin size={14} className="shrink-0 text-primary" aria-label="Angeheftet" />}
            <span className="truncate">{note.title || 'Neue Notiz'}</span>
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">{note.preview || 'Kein weiterer Text'}</span>
          <span className="mt-0.5 block text-xs text-muted">
            {formatRelativeDate(note.updated_at)}
            {author && ` · ${author}`}
          </span>
        </Link>
      </li>
    )
  }

  const isEmpty = notes.pinned.length === 0 && notes.other.length === 0

  return (
    <>
      <PageHeader
        title="Notizen"
        settings
        actions={
          <button className="icon-btn text-primary" aria-label="Neue Notiz" onClick={() => void create()}>
            <Plus size={26} />
          </button>
        }
      />
      <main className="mx-auto max-w-2xl px-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3.5 text-muted" aria-hidden />
          <input
            className="input !pl-9"
            type="search"
            placeholder="Suchen"
            aria-label="Notizen durchsuchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {createError && (
          <div className="mt-3">
            <ErrorBox message={createError} />
          </div>
        )}
        {error && (
          <div className="mt-3">
            <ErrorBox message={error} onRetry={() => void refresh()} />
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : isEmpty ? (
          search ? (
            <EmptyState icon={Search} title="Nichts gefunden" />
          ) : (
            <EmptyState icon={StickyNote} title="Noch keine Notizen" text="Haltet hier fest, was ihr beide im Blick behalten wollt.">
              <button className="btn btn-primary" onClick={() => void create()}>
                Erste Notiz schreiben
              </button>
            </EmptyState>
          )
        ) : (
          <div className="mt-4 space-y-4">
            {notes.pinned.length > 0 && (
              <section>
                <h2 className="mb-1 px-1 text-sm font-semibold text-muted">Angeheftet</h2>
                <ul className="card divide-y divide-line">{notes.pinned.map(row)}</ul>
              </section>
            )}
            {notes.other.length > 0 && <ul className="card divide-y divide-line">{notes.other.map(row)}</ul>}
          </div>
        )}
      </main>
    </>
  )
}
