import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHouseholdContext } from '../context/HouseholdContext'
import { CenteredMessage, ErrorBox } from '../components/ui'
import { supabase } from '../lib/supabase'

export function OnboardingPage() {
  const { reload } = useHouseholdContext()
  const { signOut } = useAuth()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const memberName = name.trim()
    const { error: rpcError } =
      mode === 'create'
        ? await supabase.rpc('create_household', { household_name: 'Unser Haushalt', member_name: memberName })
        : await supabase.rpc('join_household', { code: code.trim(), member_name: memberName })
    if (rpcError) {
      setError(rpcError.message)
      setBusy(false)
      return
    }
    await reload()
    setBusy(false)
  }

  return (
    <CenteredMessage>
      <h1 className="text-2xl font-bold">Willkommen bei Crack</h1>
      <p className="mt-1 text-muted">
        Eure Listen, Rezepte und Notizen teilt ihr über einen gemeinsamen Haushalt. Eine Person legt ihn an, die andere
        tritt mit dem Einladungscode bei.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className={`chip justify-center ${mode === 'create' ? 'chip-active' : ''}`} onClick={() => setMode('create')}>
          Haushalt anlegen
        </button>
        <button className={`chip justify-center ${mode === 'join' ? 'chip-active' : ''}`} onClick={() => setMode('join')}>
          Beitreten
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="name">
            Dein Name
          </label>
          <input
            id="name"
            className="input"
            required
            maxLength={40}
            autoComplete="given-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {mode === 'join' && (
          <div>
            <label className="label" htmlFor="code">
              Einladungscode
            </label>
            <input
              id="code"
              className="input"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <p className="mt-1 text-sm text-muted">Den Code findet die andere Person in den Einstellungen.</p>
          </div>
        )}
        {error && <ErrorBox message={error} />}
        <button className="btn btn-primary w-full" disabled={busy}>
          {mode === 'create' ? 'Haushalt anlegen' : 'Haushalt beitreten'}
        </button>
      </form>
      <button className="btn mt-2 w-full text-muted" onClick={() => void signOut()}>
        Abmelden
      </button>
    </CenteredMessage>
  )
}
