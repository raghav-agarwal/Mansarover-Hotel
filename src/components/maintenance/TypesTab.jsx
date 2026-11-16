import { useState } from 'react'
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Sheet from '../Sheet'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

export default function TypesTab({ types, rooms }) {
  const [editing, setEditing] = useState(null) // null | 'new' | type object
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const roomCount = (t) => rooms.filter((r) => r.typeId === t.id && r.active !== false).length

  function open(t) {
    setEditing(t || 'new')
    setName(t ? t.name : '')
    setError('')
  }

  async function save(e) {
    e.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) return setError('Name is required.')
    const editingId = editing === 'new' ? null : editing.id
    if (types.some((t) => t.id !== editingId && t.name.toLowerCase() === clean.toLowerCase())) {
      return setError('That room type already exists.')
    }
    setBusy(true)
    try {
      if (editingId) await updateDoc(doc(db, 'roomTypes', editingId), { name: clean })
      else {
        const order = types.reduce((m, t) => Math.max(m, t.order || 0), -1) + 1
        await addDoc(collection(db, 'roomTypes'), { name: clean, order, active: true })
      }
      setEditing(null)
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  function toggle(t) {
    if (t.active !== false && roomCount(t) > 0) {
      return alert(`${t.name} still has ${roomCount(t)} active room(s). Move or deactivate them first.`)
    }
    updateDoc(doc(db, 'roomTypes', t.id), { active: t.active === false })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">Each type has its own checklist.</p>
        <button onClick={() => open(null)} className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white">
          + Add type
        </button>
      </div>

      <ul className="space-y-2">
        {types.map((t) => (
          <li key={t.id}
            className={`flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 ${t.active === false ? 'opacity-60' : ''}`}>
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-stone-500">{roomCount(t)} room(s){t.active === false && ' · inactive'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => open(t)} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium">Rename</button>
              <button onClick={() => toggle(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${t.active === false ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {t.active === false ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <Sheet title={editing === 'new' ? 'Add room type' : 'Rename room type'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <input className={field} placeholder="Room type name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Cancel</button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white disabled:opacity-60">Save</button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}
