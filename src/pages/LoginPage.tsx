import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { CenteredMessage, ErrorBox } from '../components/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setError(await signIn(email, password))
    setBusy(false)
  }

  return (
    <CenteredMessage>
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="mx-auto h-20 w-20 rounded-2xl" />
      <h1 className="mt-4 text-center text-3xl font-bold">Crack</h1>
      <p className="mt-1 text-center text-muted">Melde dich an, um loszulegen.</p>
      <form className="mt-8 space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && <ErrorBox message={error} />}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Wird angemeldet …' : 'Anmelden'}
        </button>
      </form>
    </CenteredMessage>
  )
}
