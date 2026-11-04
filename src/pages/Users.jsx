import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { createUser, useAuth } from '../auth/AuthContext'
import { hashPin, isValidPin, newSalt } from '../lib/pin'
import { ROLES } from '../lib/roles'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'
const btn = 'rounded-lg px-3 py-1.5 text-sm font-medium'

const empty = { username: '', name: '', phone: '', role: 'accountant', pin: '' }

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | user id
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      onSnapshot(collection(db, 'users'), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => a.name.localeCompare(b.name))
        setUsers(list)
      }),
    []
  )

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setPin = (e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))

  function openNew() {
    setForm(empty)
    setError('')
    setEditing('new')
  }
  function openEdit(u) {
    setForm({ username: u.username, name: u.name, phone: u.phone || '', role: u.role, pin: '' })
    setError('')
    setEditing(u.id)
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (editing === 'new') {
        await createUser(form)
      } else {
        if (!form.name.trim()) throw new Error('Name is required.')
        const patch = { name: form.name.trim(), phone: form.phone.trim(), role: form.role }
        if (form.pin) {
          if (!isValidPin(form.pin)) throw new Error('PIN must be exactly 4 digits.')
          patch.pinSalt = newSalt()
          patch.pinHash = await hashPin(form.pin, patch.pinSalt)
          patch.failedAttempts = 0
          patch.lockedUntil = 0
        }
        await updateDoc(doc(db, 'users', editing), patch)
      }
      setEditing(null)
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const activeManagement = users.filter((u) => u.role === 'management' && u.active !== false)

  async function toggleActive(u) {
    const disabling = u.active !== false
    if (disabling && u.id === me.id) return alert('You cannot disable your own account.')
    if (disabling && u.role === 'management' && activeManagement.length <= 1) {
      return alert('At least one active Management user is required.')
    }
    await updateDoc(doc(db, 'users', u.id), { active: !disabling })
  }

  const editingSelf = editing === me.id
  const lastManagement =
    editing && editing !== 'new' && editingSelf && activeManagement.length <= 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Users</h2>
        <button onClick={openNew} className={`${btn} bg-amber-800 text-white active:bg-amber-900`}>
          + Add user
        </button>
      </div>

      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}
            className={`rounded-2xl border border-stone-200 bg-white p-4 ${u.active === false ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {u.name} {u.id === me.id && <span className="text-xs text-stone-400">(you)</span>}
                </p>
                <p className="text-sm text-stone-500">
                  @{u.username} · {u.phone || 'no phone'}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                {ROLES[u.role]}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(u)} className={`${btn} bg-stone-100 active:bg-stone-200`}>
                Edit / reset PIN
              </button>
              <button onClick={() => toggleActive(u)}
                className={`${btn} ${u.active === false ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {u.active === false ? 'Enable' : 'Disable'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
          <form onSubmit={save}
            className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <h3 className="text-lg font-semibold">{editing === 'new' ? 'Add user' : 'Edit user'}</h3>

            <input className={`${field} disabled:bg-stone-100`} placeholder="Username" autoCapitalize="none"
              disabled={editing !== 'new'} value={form.username} onChange={set('username')} />
            <input className={field} placeholder="Full name" value={form.name} onChange={set('name')} />
            <input className={field} placeholder="Phone number" inputMode="tel"
              value={form.phone} onChange={set('phone')} />
            <select className={field} value={form.role} onChange={set('role')} disabled={lastManagement}>
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input className={field} inputMode="numeric" maxLength={4}
              placeholder={editing === 'new' ? '4-digit PIN' : 'New 4-digit PIN (leave blank to keep)'}
              value={form.pin} onChange={setPin} />

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Cancel</button>
              <button type="submit" disabled={busy}
                className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white disabled:opacity-60">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
