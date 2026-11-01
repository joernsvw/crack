import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const ONE_HOUR = 60 * 60 * 1000
// So kurz nach dem Start hat noch niemand etwas getippt: Neu laden stoert hier nicht.
const STARTUP_WINDOW = 8000

/**
 * Neue Versionen kommen automatisch: beim Start oder sobald die App im Hintergrund ist.
 * Nur wenn sie gerade benutzt wird, erscheint ein Hinweis, damit keine Eingabe verloren geht.
 */
export function UpdatePrompt() {
  const startedAt = useRef(Date.now())
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update()
      }
      setInterval(check, ONE_HOUR)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    if (document.hidden || Date.now() - startedAt.current < STARTUP_WINDOW) {
      void updateServiceWorker(true)
      return
    }
    const onVisibility = () => {
      if (document.hidden) void updateServiceWorker(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [needRefresh, updateServiceWorker])

  if (!needRefresh) return null
  return (
    <div className="safe-top fixed inset-x-0 top-0 z-50 flex justify-center p-2">
      <button className="btn btn-primary shadow-lg" onClick={() => void updateServiceWorker(true)}>
        Neue Version – neu laden
      </button>
    </div>
  )
}
