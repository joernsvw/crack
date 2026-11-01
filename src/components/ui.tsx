import { useEffect, type ReactNode } from 'react'
import { ArrowLeft, Loader2, Settings, X, type LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export function Spinner({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center text-primary ${fullscreen ? 'min-h-dvh' : 'py-16'}`}
      role="status"
      aria-label="Lädt"
    >
      <Loader2 className="animate-spin" size={32} />
    </div>
  )
}

export function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="safe-top flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-danger-soft p-4 text-danger" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="mt-2 font-semibold underline" onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon
  title: string
  text?: string
  children?: ReactNode
}) {
  return (
    <div className="fade-in flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary-soft-ink">
        <Icon size={30} />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 max-w-xs text-muted">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  back,
  actions,
  settings = false,
}: {
  title: string
  /** Ziel des Zurueck-Pfeils; true geht einen Schritt in der Historie zurueck. */
  back?: string | true
  actions?: ReactNode
  settings?: boolean
}) {
  const navigate = useNavigate()
  return (
    <header className="safe-top sticky top-0 z-20 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1 px-2">
        {back && (
          <button
            className="icon-btn text-ink"
            aria-label="Zurück"
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
          >
            <ArrowLeft size={24} />
          </button>
        )}
        <h1 className={`min-w-0 flex-1 truncate font-bold ${back ? 'text-lg' : 'pl-2 text-2xl'}`}>{title}</h1>
        {actions}
        {settings && (
          <Link to="/einstellungen" className="icon-btn" aria-label="Einstellungen">
            <Settings size={22} />
          </Link>
        )}
      </div>
    </header>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in safe-bottom max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="icon-btn" aria-label="Schließen" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}

export function MemberInitial({ name }: { name: string | null }) {
  if (!name) return null
  return (
    <span
      title={`Von ${name}`}
      aria-label={`Von ${name}`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-ink"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
