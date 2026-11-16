import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMaintenance } from '../lib/useMaintenance'
import { seedDefaults } from '../lib/maintenance'
import TypesTab from '../components/maintenance/TypesTab'
import RoomsTab from '../components/maintenance/RoomsTab'
import ChecklistTab from '../components/maintenance/ChecklistTab'

const TABS = [
  { id: 'checklists', label: 'Checklists' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'types', label: 'Room types' },
]

export default function MaintenanceSetup() {
  const { loading, types, rooms, items } = useMaintenance()
  const [tab, setTab] = useState('checklists')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setBusy(true)
    setError('')
    try {
      await seedDefaults()
    } catch (err) {
      setError(err.message || 'Could not load defaults.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-stone-500">Loading…</p>

  return (
    <div className="space-y-4">
      <div>
        <Link to="/maintenance" className="text-sm text-amber-800">← Maintenance</Link>
        <h2 className="mt-1 text-xl font-semibold">Maintenance setup</h2>
      </div>

      {types.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Nothing is set up yet</p>
          <p className="text-sm text-amber-900">
            Load the hotel's 4 room types, 37 rooms and the standard checklist (15 room items, 6 washroom items per type).
            You can change everything afterwards.
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button onClick={load} disabled={busy}
            className="w-full rounded-xl bg-amber-800 py-3 font-medium text-white disabled:opacity-60">
            {busy ? 'Loading…' : 'Load default rooms & checklists'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${tab === t.id ? 'bg-white shadow-sm' : 'text-stone-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'checklists' && <ChecklistTab types={types} items={items} />}
          {tab === 'rooms' && <RoomsTab types={types} rooms={rooms} />}
          {tab === 'types' && <TypesTab types={types} rooms={rooms} />}
        </>
      )}
    </div>
  )
}
