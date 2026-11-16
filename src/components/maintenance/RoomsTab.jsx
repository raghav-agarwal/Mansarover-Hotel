import { useMemo, useState } from 'react'
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import Sheet from '../Sheet'
import { cleanRoomNo, compareRooms, floorOf, roomKey } from '../../lib/maintenance'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

export default function RoomsTab({ types, rooms }) {
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | room object
  const [form, setForm] = useState({ number: '', typeId: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const activeTypes = types.filter((t) => t.active !== false)
  const typeName = (id) => types.find((t) => t.id === id)?.name || '—'

  const shown = useMemo(() => {
    const q = roomKey(search)
    return rooms
      .filter((r) => (typeFilter === 'all' || r.typeId === typeFilter) && (!q || roomKey(r.number).includes(q)))
      .sort((a, b) => compareRooms(a.number, b.number))
  }, [rooms, typeFilter, search])

  function open(r) {
    setEditing(r || 'new')
    setForm(r ? { number: r.number, typeId: r.typeId } : { number: '', typeId: activeTypes[0]?.id || '' })
    setError('')
  }

  async function save(e) {
    e.preventDefault()
    const number = cleanRoomNo(form.number)
    if (!number) return setError('Room number is required.')
    if (!form.typeId) return setError('Choose a room type.')
    const editingId = editing === 'new' ? null : editing.id
    if (rooms.some((r) => r.id !== editingId && roomKey(r.number) === roomKey(number))) {
      return setError(`Room ${number} already exists.`)
    }
    setBusy(true)
    try {
      if (editingId) await updateDoc(doc(db, 'rooms', editingId), { number, typeId: form.typeId })
      else await addDoc(collection(db, 'rooms'), { number, typeId: form.typeId, active: true, createdAt: Date.now() })
      setEditing(null)
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (r) => updateDoc(doc(db, 'rooms', r.id), { active: r.active === false })
  const activeCount = rooms.filter((r) => r.active !== false).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{activeCount} active room(s)</p>
        <button onClick={() => open(null)} className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white">
          + Add room
        </button>
      </div>

      <div className="flex gap-2">
        <input className={field} placeholder="Search room no." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${field} max-w-[45%]`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.id}
            className={`flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 ${r.active === false ? 'opacity-60' : ''}`}>
            <div>
              <p className="font-medium">Room {r.number}{r.active === false && <span className="ml-2 text-xs text-stone-400">inactive</span>}</p>
              <p className="text-xs text-stone-500">{typeName(r.typeId)} · {floorOf(r.number)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => open(r)} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium">Edit</button>
              <button onClick={() => toggle(r)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${r.active === false ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {r.active === false ? 'Activate' : 'Deactivate'}
              </button>
            </div>
          </li>
        ))}
        {shown.length === 0 && <p className="py-6 text-center text-stone-400">No rooms match.</p>}
      </ul>

      {editing && (
        <Sheet title={editing === 'new' ? 'Add room' : 'Edit room'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-3">
            <input className={field} placeholder="Room number (e.g. 105 or G 3)" value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} autoFocus />
            <select className={field} value={form.typeId} onChange={(e) => setForm((f) => ({ ...f, typeId: e.target.value }))}>
              {activeTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {editing !== 'new' && editing.typeId !== form.typeId && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Future checklists for this room will use the new type's checklist. Past checklists are not changed.
              </p>
            )}
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
