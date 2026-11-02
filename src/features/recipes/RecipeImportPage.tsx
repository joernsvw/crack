import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ClipboardPaste, Link2, Loader2, Sparkles } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBox, PageHeader } from '../../components/ui'
import { draftFromScreenshots, extractFirstUrl, importRecipeFromLink } from './importLink'
import { ScreenshotButton, ScreenshotChips } from './ScreenshotPicker'

export function RecipeImportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const sharedLink = (location.state as { link?: string } | null)?.link ?? null
  const [link, setLink] = useState(sharedLink ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const start = useCallback(
    async (raw: string) => {
      const url = extractFirstUrl(raw)
      if (!url) {
        setError('Das sieht nicht nach einem Link aus. Er muss mit https:// beginnen.')
        return
      }
      setBusy(true)
      setError(null)
      try {
        const draft = await importRecipeFromLink(url)
        navigate('/rezepte/neu', { replace: true, state: { draft } })
      } catch (err) {
        setError((err as Error).message)
        setBusy(false)
      }
    },
    [navigate],
  )

  // Aus einer anderen App geteilt: Der Link ist schon da, also direkt loslegen.
  useEffect(() => {
    if (sharedLink && !started.current) {
      started.current = true
      void start(sharedLink)
    }
  }, [sharedLink, start])

  const startFromScreenshots = async () => {
    setBusy(true)
    setError(null)
    try {
      const draft = await draftFromScreenshots(files)
      navigate('/rezepte/neu', { replace: true, state: { draft } })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const paste = async () => {
    setError(null)
    try {
      const text = await navigator.clipboard.readText()
      const url = extractFirstUrl(text)
      if (url) {
        setLink(url)
        void start(url)
      } else {
        setError('In der Zwischenablage liegt kein Link.')
      }
    } catch {
      setError('Die Zwischenablage ist nicht freigegeben. Füge den Link bitte von Hand ins Feld ein.')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void start(link)
  }

  if (busy) {
    return (
      <>
        <PageHeader title="Rezept erstellen" />
        <main className="fade-in mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
          <Loader2 size={40} className="animate-spin text-primary" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold">Crack liest das Rezept …</h2>
          <p className="mt-1 text-muted" role="status">
            Titel, Bild, Zutaten und Schritte werden übernommen. Das dauert meist nur ein paar Sekunden.
          </p>
        </main>
      </>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title="Rezept hinzufügen" back="/rezepte" />
      <main className="mx-auto max-w-2xl space-y-4 px-4 pt-1">
        <p className="text-muted">
          Füge einen Link von TikTok, Pinterest, Instagram, YouTube oder einem Blog ein. Crack erstellt daraus einen Entwurf,
          den du danach noch anpassen kannst.
        </p>

        <button type="button" className="btn btn-primary w-full" onClick={() => void paste()}>
          <ClipboardPaste size={20} aria-hidden /> Link aus Zwischenablage einfügen
        </button>

        <form className="space-y-2" onSubmit={submit}>
          <label className="label" htmlFor="link">
            Oder Link eintippen
          </label>
          <div className="relative">
            <Link2 size={18} className="absolute left-3 top-3.5 text-muted" aria-hidden />
            <input
              id="link"
              className="input !pl-9"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
          </div>
          <button className="btn btn-soft w-full" disabled={!link.trim()}>
            <Sparkles size={18} aria-hidden /> Rezept erstellen
          </button>
        </form>

        <section className="space-y-2 border-t border-line pt-4">
          <h2 className="font-semibold">Oder per Screenshot</h2>
          <p className="text-sm text-muted">Bis zu 4 Bilder mit Zutaten und Schritten, zum Beispiel aus einem Video oder Kochbuch.</p>
          <ScreenshotChips files={files} disabled={busy} onChange={setFiles} />
          <div className="grid grid-cols-2 gap-2">
            <ScreenshotButton files={files} disabled={busy} label="Bilder wählen" onChange={setFiles} />
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={files.length === 0}
              onClick={() => void startFromScreenshots()}
            >
              <Sparkles size={18} aria-hidden /> Rezept erstellen
            </button>
          </div>
        </section>

        {error && <ErrorBox message={error} />}

        <p className="text-center text-sm text-muted">
          Lieber selbst schreiben?{' '}
          <Link to="/rezepte/neu" className="font-semibold text-primary">
            Von Hand anlegen
          </Link>
        </p>
      </main>
    </div>
  )
}
