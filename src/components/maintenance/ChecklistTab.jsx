import { useState } from 'react'
import { addDoc, collection, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase'
import Sheet from '../Sheet'
import { SECTIONS } from '../../lib/maintenance'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

const norm = (s) => s.trim().replace(/\s+/g, ' ')

export default function ChecklistTab({ types, items }) {
  const activeTypes = types.filter((t) => t.active !== false)
  const [typeId, setTypeId] = useState('')
  const current = activeTypes.find((t) => t.id === typeId) || activeTypes[0]
  const [newLabel, setNewLabel] = useState({ room: '', washroom: '' })
  const [rename, setRename] = useState(null) // item being renamed
  const [renameText, setRenameText] = useState('')
  const [error, setError] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [msg, setMsg] = useState('')

  if (!current) return <p className="py-6 text-center text-stone-400">Add a room type first.</p>

  const listFor = (section) =>
    items.filter((i) => i.typeId === current.id && i.section === section).sort((a, b) => (a.order || 0) - (b.order || 0))
  const nextOrder = (section) => listFor(section).reduce((m, i) => Math.max(m, i.order || 0), -1) + 1
  const hasLabel = (section, label, exceptId) =>
    listFor(section).some((i) => i.id !== exceptId && i.label.toLowerCase() === label.toLowerCase())

  async function add(section) {
    const label = norm(newLabel[section])
    setError('')
    if (!label) return
    if (hasLabel(section, label)) return setError(`"${label}" is already in the ${SECTIONS[section]} list.`)
    await addDoc(collection(db, 'checklistItems'), {
      typeId: current.id, section, label, order: nextOrder(section), active: true,
    })
    setNewLabel((n) => ({ ...n, [section]: '' }))
  }

  async function saveRename(e) {
    e.preventDefault()
    const label = norm(renameText)
    if (!label) return setError('Name is required.')
    if (hasLabel(rename.section, label, rename.id)) return setError(`"${label}" already exists in this list.`)
    await updateDoc(doc(db, 'checklistItems', rename.id), { label })
    setRename(null)
    setError('')
  }

  async function move(section, index, dir) {
    const list = listFor(section)
    const a = list[index]
    const b = list[index + dir]
    if (!b) return
    const batch = writeBatch(db)
    // Re-number the whole list so ordering stays clean even if older items share a number.
    const reordered = [...list]
    reordered[index] = b
    reordered[index + dir] = a
    reordered.forEach((it, i) => {
      if (it.order !== i) batch.update(doc(db, 'checklistItems', it.id), { order: i })
    })
    await batch.commit()
  }

  const toggle = (it) => updateDoc(doc(db, 'checklistItems', it.id), { active: it.active === false })

  async function copy() {
    if (!copyFrom) return
    const batch = writeBatch(db)
    let added = 0
    for (const section of Object.keys(SECTIONS)) {
      let order = nextOrder(section)
      items
        .filter((i) => i.typeId === copyFrom && i.section === section && i.active !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach((src) => {
          if (hasLabel(section, src.label)) return
          batch.set(doc(collection(db, 'checklistItems')), {
            typeId: current.id, section, label: src.label, order: order++, active: true,
          })
          added += 1
        })
    }
    if (added) await batch.commit()
    setMsg(added ? `Copied ${added} item(s).` : 'Nothing to copy: all items already exist here.')
    setCopyFrom('')
  }

  return (
    <div className="space-y-4">
      <select className={field} value={current.id} onChange={(e) => { setTypeId(e.target.value); setError(''); setMsg('') }}>
        {activeTypes.map((t) => <option key={t.id} value={t.id}>{t.name} checklist</option>)}
      </select>

      {Object.entries(SECTIONS).map(([section, title]) => {
        const list = listFor(section)
        return (
          <section key={section} className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="mb-2 font-semibold text-amber-900">
              {title} <span className="text-sm font-normal text-stone-400">({list.filter((i) => i.active !== false).length} active)</span>
            </h3>
            <ul className="divide-y divide-stone-100">
              {list.map((it, idx) => (
                <li key={it.id} className="flex items-center gap-1 py-1.5">
                  <span className={`min-w-0 flex-1 truncate ${it.active === false ? 'text-stone-400 line-through' : ''}`}>{it.label}</span>
                  <button aria-label="Move up" disabled={idx === 0} onClick={() => move(section, idx, -1)}
                    className="rounded-md px-2 py-1 text-stone-600 disabled:opacity-25">↑</button>
                  <button aria-label="Move down" disabled={idx === list.length - 1} onClick={() => move(section, idx, 1)}
                    className="rounded-md px-2 py-1 text-stone-600 disabled:opacity-25">↓</button>
                  <button onClick={() => { setRename(it); setRenameText(it.label); setError('') }}
                    className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium">Rename</button>
                  <button onClick={() => toggle(it)}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${it.active === false ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                    {it.active === false ? 'Activate' : 'Deactivate'}
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="py-3 text-sm text-stone-400">No items yet.</li>}
            </ul>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(section) }}>
              <input className={field} placeholder={`Add ${title.toLowerCase()} item`} value={newLabel[section]}
                onChange={(e) => setNewLabel((n) => ({ ...n, [section]: e.target.value }))} />
              <button type="submit" className="shrink-0 rounded-xl bg-amber-800 px-4 font-medium text-white">Add</button>
            </form>
          </section>
        )
      })}

      {error && !rename && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {activeTypes.length > 1 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium">Copy items from another type</p>
          <div className="flex gap-2">
            <select className={field} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Choose a type…</option>
              {activeTypes.filter((t) => t.id !== current.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={copy} disabled={!copyFrom} className="shrink-0 rounded-xl bg-stone-200 px-4 font-medium disabled:opacity-40">Copy</button>
          </div>
          <p className="mt-2 text-xs text-stone-500">Only adds items that are missing here. Nothing is replaced or removed.</p>
          {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
        </div>
      )}

      <p className="text-xs text-stone-500">
        Deactivated items disappear from new checklists. Checklists already filled keep the items they were filled with.
      </p>

      {rename && (
        <Sheet title="Rename item" onClose={() => setRename(null)}>
          <form onSubmit={saveRename} className="space-y-3">
            <input className={field} value={renameText} onChange={(e) => setRenameText(e.target.value)} autoFocus />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setRename(null)} className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Cancel</button>
              <button type="submit" className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white">Save</button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  )
}
