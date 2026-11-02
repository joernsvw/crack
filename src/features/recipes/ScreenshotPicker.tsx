import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'

const MAX_FILES = 4

export function ScreenshotChips({ files, disabled, onChange }: { files: File[]; disabled: boolean; onChange: (files: File[]) => void }) {
  if (files.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`}>
          <button
            type="button"
            className="chip"
            aria-label={`Bild ${index + 1} entfernen`}
            disabled={disabled}
            onClick={() => onChange(files.filter((_, position) => position !== index))}
          >
            Bild {index + 1} <X size={14} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ScreenshotButton({
  files,
  disabled,
  label = 'Screenshot',
  onChange,
}: {
  files: File[]
  disabled: boolean
  label?: string
  onChange: (files: File[]) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const full = files.length >= MAX_FILES

  const add = (selected: FileList | null) => {
    // Vor dem Leeren kopieren: Die FileList ist live und waere danach leer.
    onChange([...files, ...Array.from(selected ?? [])].slice(0, MAX_FILES))
    // Sonst loest dieselbe Datei beim zweiten Auswaehlen kein Ereignis aus.
    if (input.current) input.current.value = ''
  }

  return (
    <label className={`btn btn-soft cursor-pointer text-sm ${disabled || full ? 'opacity-55' : ''}`}>
      <ImagePlus size={18} aria-hidden /> {label}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        disabled={disabled || full}
        onChange={(event) => add(event.target.files)}
      />
    </label>
  )
}
