import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, Heading1, List, ListChecks, Pin, PinOff, Trash2 } from 'lucide-react'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Placeholder from '@tiptap/extension-placeholder'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { useHousehold } from '../../context/HouseholdContext'
import { useRealtime } from '../../hooks/useRealtime'
import { formatRelativeDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Note } from '../../lib/types'
import { deriveTitleAndPreview } from './noteText'

const SAVE_DELAY = 700
const EXTENSIONS = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder: 'Schreib etwas …' }),
]

type SaveState = 'saved' | 'saving' | 'dirty' | 'error'

export function NoteEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { householdId, memberName } = useHousehold()
  const [note, setNote] = useState<Note | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')

  const saveStateRef = useRef<SaveState>('saved')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const editorRef = useRef<Editor | null>(null)
  const contentRef = useRef<JSONContent | null>(null)
  const deleted = useRef(false)

  const updateSaveState = (next: SaveState) => {
    saveStateRef.current = next
    setSaveState(next)
  }

  const save = useCallback(async () => {
    clearTimeout(timer.current)
    const content = contentRef.current
    if (!content || !id || deleted.current) return
    updateSaveState('saving')
    const { error } = await supabase
      .from('notes')
      .update({ content, ...deriveTitleAndPreview(content) })
      .eq('id', id)
    // Wurde waehrend des Speicherns weitergetippt, laeuft bereits der naechste Timer.
    if (contentRef.current !== content) return
    updateSaveState(error ? 'error' : 'saved')
  }, [id])

  const editor = useEditor({
    extensions: EXTENSIONS,
    onUpdate: ({ editor: current }) => {
      contentRef.current = current.getJSON()
      updateSaveState('dirty')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), SAVE_DELAY)
    },
  })
  editorRef.current = editor

  const load = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase.from('notes').select('*').eq('id', id).maybeSingle()
    if (error) {
      setLoadError(navigator.onLine ? error.message : 'Diese Notiz ist offline nicht verfügbar.')
      return
    }
    if (!data) {
      setLoadError('Diese Notiz gibt es nicht mehr.')
      return
    }
    setLoadError(null)
    setNote(data as Note)
    // Eigene Eingaben haben Vorrang. Der Vergleich ueber ProseMirror ignoriert die Schluessel-Reihenfolge von jsonb.
    const current = editorRef.current
    if (current && saveStateRef.current === 'saved') {
      contentRef.current = data.content
      const incoming = ProseMirrorNode.fromJSON(current.schema, data.content)
      if (!incoming.eq(current.state.doc)) current.commands.setContent(data.content, { emitUpdate: false })
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load, editor])

  useRealtime(householdId, ['notes'], load)

  // Nicht gespeicherte Eingaben sichern: beim Verlassen, im Hintergrund und nach einem Verbindungsabbruch.
  useEffect(() => {
    const saveIfNeeded = () => {
      if (saveStateRef.current === 'dirty' || saveStateRef.current === 'error') void save()
    }
    const onVisibility = () => {
      if (document.hidden) saveIfNeeded()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', saveIfNeeded)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', saveIfNeeded)
    }
  }, [save])

  // Laeuft auch bei der Zuruecktaste von Android, die nicht ueber den Knopf im Kopf der Seite geht.
  const finish = useCallback(async () => {
    const content = contentRef.current
    if (!id || !content || deleted.current) return
    if (!deriveTitleAndPreview(content).title) {
      // Leere Notizen hinterlassen sonst Karteileichen in der Liste.
      deleted.current = true
      clearTimeout(timer.current)
      await supabase.from('notes').delete().eq('id', id)
    } else if (saveStateRef.current !== 'saved') {
      await save()
    }
  }, [id, save])

  useEffect(() => () => void finish(), [finish])

  const leave = async () => {
    await finish()
    navigate('/notizen')
  }

  const togglePin = async () => {
    if (!note) return
    setNote({ ...note, pinned: !note.pinned })
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id)
  }

  const remove = async () => {
    if (!id || !window.confirm('Diese Notiz wirklich löschen?')) return
    deleted.current = true
    clearTimeout(timer.current)
    await supabase.from('notes').delete().eq('id', id)
    navigate('/notizen')
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Notiz" back="/notizen" />
        <main className="mx-auto max-w-2xl p-4">
          <ErrorBox message={loadError} onRetry={() => void load()} />
        </main>
      </>
    )
  }

  const author = memberName(note?.updated_by ?? null)
  const status = {
    saved: note ? `Zuletzt bearbeitet: ${formatRelativeDate(note.updated_at)}${author ? ` von ${author}` : ''}` : '',
    saving: 'Wird gespeichert …',
    dirty: 'Wird gespeichert …',
    error: 'Nicht gespeichert. Wird wiederholt, sobald du online bist.',
  }[saveState]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1 px-2">
          <button className="btn !px-2 font-semibold text-primary" onClick={() => void leave()}>
            ‹ Notizen
          </button>
          <span className="flex-1" />
          {note && (
            <button className="icon-btn" aria-label={note.pinned ? 'Nicht mehr anheften' : 'Anheften'} onClick={() => void togglePin()}>
              {note.pinned ? <PinOff size={20} /> : <Pin size={20} />}
            </button>
          )}
          <button className="icon-btn" aria-label="Notiz löschen" onClick={() => void remove()}>
            <Trash2 size={20} />
          </button>
        </div>
        {editor && <Toolbar editor={editor} />}
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-3">
        <p className={`mb-3 text-center text-xs ${saveState === 'error' ? 'text-danger' : 'text-muted'}`} role="status">
          {status}
        </p>
        {note ? <EditorContent editor={editor} /> : <Spinner />}
      </main>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading: current.isActive('heading'),
      bold: current.isActive('bold'),
      bullet: current.isActive('bulletList'),
      task: current.isActive('taskList'),
    }),
  })

  const button = (label: string, isActive: boolean, run: () => void, icon: ReactNode) => (
    <button
      type="button"
      className={`flex h-10 flex-1 items-center justify-center rounded-lg ${
        isActive ? 'bg-primary-soft text-primary-soft-ink' : 'text-muted'
      }`}
      aria-label={label}
      aria-pressed={isActive}
      // mouseDown statt click: So bleibt der Fokus im Text und die Tastatur offen.
      onMouseDown={(event) => {
        event.preventDefault()
        run()
      }}
    >
      {icon}
    </button>
  )

  return (
    <div className="mx-auto flex max-w-2xl gap-1 border-b border-line px-4 pb-1">
      {button('Überschrift', active.heading, () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={20} />)}
      {button('Fett', active.bold, () => editor.chain().focus().toggleBold().run(), <Bold size={20} />)}
      {button('Aufzählung', active.bullet, () => editor.chain().focus().toggleBulletList().run(), <List size={20} />)}
      {button('Checkliste', active.task, () => editor.chain().focus().toggleTaskList().run(), <ListChecks size={20} />)}
    </div>
  )
}
