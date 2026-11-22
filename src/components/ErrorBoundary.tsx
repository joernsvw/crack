import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Faengt Abstuerze einer Seite ab. Statt einer weissen Seite steht dann da, was passiert ist,
 * und der Fehlertext laesst sich fuer die Fehlersuche weitergeben.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(previous: { resetKey?: string }) {
    // Nach einem Seitenwechsel neu versuchen, sonst bliebe die Fehlermeldung ueberall stehen.
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="safe-top mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-bold">Hier ist etwas schiefgelaufen</h1>
        <p className="mt-2 text-muted">Lade Crack bitte neu. Passiert es wieder, schick einen Screenshot dieser Seite.</p>
        <pre className="card mt-4 overflow-x-auto whitespace-pre-wrap p-3 text-xs text-muted">
          {error.name}: {error.message}
          {'\n'}
          {navigator.userAgent}
        </pre>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Neu laden
          </button>
          <a className="btn btn-soft" href="#/einkauf" onClick={() => this.setState({ error: null })}>
            Zur Startseite
          </a>
        </div>
      </div>
    )
  }
}
