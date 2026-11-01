import { useRef, useState, type FormEvent } from 'react'
import { ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErrorBox } from '../../components/ui'
import { proposeRecipeEdit } from './importLink'

const MAX_FILES = 4

export function RecipeAiEdit({ recipeId }: { recipeId: string }) {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [instruction, setInstruction] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = (selected: FileList | null) => {
    // Vor dem Leeren kopieren: Die FileList ist live und waere danach leer.
    const added = Array.from(selected ?? [])
    setFiles((current) => [...current, ...added].slice(0, MAX_FILES))
    // Sonst loest dieselbe Datei beim zweiten Auswaehlen kein Ereignis aus.
    if (fileInput.current) fileInput.current.value = ''
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const draft = await proposeRecipeEdit(recipeId, instruction, files)
      navigate(`/rezepte/${recipeId}/bearbeiten`, { state: { draft } })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles size={18} className="text-primary" aria-hidden /> Mit KI anpassen
      </h2>
      <form className="mt-2 space-y-2" onSubmit={submit}>
        <textarea
          className="input"
          rows={2}
          placeholder="z. B. Tofu durch Halloumi ersetzen"
          aria-label="Was soll sich ändern?"
          maxLength={2000}
          disabled={busy}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />

        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <button
                  type="button"
                  className="chip"
                  aria-label={`Bild ${index + 1} entfernen`}
                  disabled={busy}
                  onClick={() => setFiles(files.filter((_, position) => position !== index))}
                >
                  Bild {index + 1} <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className={`btn btn-soft cursor-pointer text-sm ${busy || files.length >= MAX_FILES ? 'opacity-55' : ''}`}>
            <ImagePlus size={18} aria-hidden /> Screenshot
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={busy || files.length >= MAX_FILES}
              onChange={(event) => addFiles(event.target.files)}
            />
          </label>
          <button className="btn btn-primary text-sm" disabled={busy || (!instruction.trim() && files.length === 0)}>
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />}
            {busy ? 'Einen Moment …' : 'Anpassen'}
          </button>
        </div>
        <p className="text-xs text-muted">
          Beschreibe die Änderung oder füge Screenshots mit Zutaten oder Schritten hinzu. Du siehst den Vorschlag, bevor etwas
          gespeichert wird.
        </p>
        {error && <ErrorBox message={error} />}
      </form>
    </section>
  )
}
