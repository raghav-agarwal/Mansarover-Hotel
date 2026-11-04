import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { createUser, hasAnyUser, useAuth } from '../auth/AuthContext'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [firstRun, setFirstRun] = useState(null) // null = checking
  const [form, setForm] = useState({ username: '', name: '', phone: '', pin: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    hasAnyUser()
      .then((any) => setFirstRun(!any))
      .catch(() => setFirstRun(false))
  }, [])

  if (user) return <Navigate to={location.state?.from?.pathname || '/'} replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setPin = (e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (firstRun) {
        await createUser({ ...form, role: 'management' })
      }
      await login(form.username, form.pin)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-amber-50 px-5">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <img src="/icon-192.png" alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl" />
          <h1 className="text-2xl font-semibold text-stone-900">Hotel Mansarover</h1>
          <p className="text-sm text-stone-500">
            {firstRun ? 'First-time setup: create the Management account' : 'Sign in with your PIN'}
          </p>
        </div>

        {firstRun === null ? (
          <p className="text-center text-stone-500">Checking…</p>
        ) : (
          <>
            <input className={field} placeholder="Username" autoCapitalize="none" autoComplete="username"
              value={form.username} onChange={set('username')} />
            {firstRun && (
              <>
                <input className={field} placeholder="Full name" value={form.name} onChange={set('name')} />
                <input className={field} placeholder="Phone number" inputMode="tel"
                  value={form.phone} onChange={set('phone')} />
              </>
            )}
            <input className={`${field} text-center text-2xl tracking-[0.6em]`} placeholder="••••"
              type="password" inputMode="numeric" autoComplete="current-password" maxLength={4}
              value={form.pin} onChange={setPin} />

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={busy}
              className="w-full rounded-xl bg-amber-800 py-3 text-base font-medium text-white active:bg-amber-900 disabled:opacity-60">
              {busy ? 'Please wait…' : firstRun ? 'Create account & sign in' : 'Sign in'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
