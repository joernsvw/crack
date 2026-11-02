import { useState, type FormEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ErrorBox } from '../../components/ui'
import { proposeRecipeEdit } from './importLink'
import { ScreenshotButton, ScreenshotChips } from './ScreenshotPicker'

export function RecipeAiEdit({ recipeId }: { recipeId: string }) {
  const navigate = useNavigate()
  const [instruction, setInstruction] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <ScreenshotChips files={files} disabled={busy} onChange={setFiles} />
        <div className="grid grid-cols-2 gap-2">
          <ScreenshotButton files={files} disabled={busy} onChange={setFiles} />
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
