import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { latestByRoom, useChecks, useMaintenance } from '../lib/useMaintenance'
import { compareRooms, roomKey } from '../lib/maintenance'
import { can } from '../lib/roles'
import { todayIST } from '../lib/dates'
import MaintNav from '../components/maintenance/MaintNav'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

const short = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

export default function Maintenance() {
  const { user } = useAuth()
  const location = useLocation()
  const { loading, types, rooms, items } = useMaintenance()
  const { checks, drafts } = useChecks()
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const isManagement = can(user, 'maintenanceSetup')
  const canFill = can(user, 'maintenanceFill')
  const month = todayIST().slice(0, 7)
  const done = location.state?.done

  const last = useMemo(() => latestByRoom(checks), [checks])
  const draftIds = useMemo(() => new Set(drafts.map((d) => d.roomId)), [drafts])
  const checkedThisMonth = useMemo(() => new Set(checks.filter((c) => c.month === month).map((c) => c.roomId)), [checks, month])

  const groups = useMemo(() => {
    const q = roomKey(search)
    return types
      .filter((t) => t.active !== false && (typeFilter === 'all' || t.id === typeFilter))
      .map((t) => ({
        type: t,
        rooms: rooms
          .filter((r) => r.typeId === t.id && r.active !== false && (!q || roomKey(r.number).includes(q)))
          .sort((a, b) => compareRooms(a.number, b.number)),
        itemCount: items.filter((i) => i.typeId === t.id && i.active !== false).length,
      }))
      .filter((g) => g.rooms.length > 0)
  }, [types, rooms, items, typeFilter, search])

  const activeRooms = rooms.filter((r) => r.active !== false)
  const doneThisMonth = activeRooms.filter((r) => checkedThisMonth.has(r.id)).length

  if (loading) return <p className="text-stone-500">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Maintenance</h2>
        {isManagement && (
          <Link to="/maintenance/setup" className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium">Setup</Link>
        )}
      </div>

      <MaintNav />

      {done && (
        <p className={`rounded-xl p-3 text-sm ${done.fails ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
          ✓ Room {done.room} checklist submitted{done.fails ? ` with ${done.fails} issue(s) noted.` : ', all OK.'}
        </p>
      )}

      {types.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-stone-500">
          {isManagement ? (
            <>
              <p>Rooms and checklists are not set up yet.</p>
              <Link to="/maintenance/setup" className="mt-3 inline-block rounded-xl bg-amber-800 px-4 py-2 font-medium text-white">
                Open setup
              </Link>
            </>
          ) : (
            <p>Maintenance is not set up yet. Ask Management to set up the rooms.</p>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">This month</span>
              <span>{doneThisMonth} of {activeRooms.length} rooms checked</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-green-600" style={{ width: `${activeRooms.length ? (doneThisMonth / activeRooms.length) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="flex gap-2">
            <input className={field} placeholder="Find room no." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={`${field} max-w-[45%]`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {types.filter((t) => t.active !== false).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-green-500" />checked, OK</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />issues</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />draft</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-stone-300" />not this month</span>
          </p>

          {groups.length === 0 && <p className="py-6 text-center text-stone-400">No rooms match.</p>}

          {groups.map((g) => (
            <section key={g.type.id} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-amber-900">{g.type.name}</h3>
                <span className="text-xs text-stone-500">{g.rooms.length} rooms · {g.itemCount} checklist items</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {g.rooms.map((r) => {
                  const l = last[r.id]
                  const hasDraft = draftIds.has(r.id)
                  const dot = hasDraft ? 'bg-amber-400'
                    : l && l.month === month ? (l.failCount > 0 ? 'bg-red-500' : 'bg-green-500')
                    : 'bg-stone-300'
                  const body = (
                    <>
                      <span className="flex items-center justify-center gap-1.5 font-medium">
                        <span className={`h-2 w-2 rounded-full ${dot}`} />{r.number}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-stone-400">
                        {hasDraft ? 'draft' : l ? short(l.date) : 'never'}
                      </span>
                    </>
                  )
                  const cls = 'block rounded-xl border border-stone-200 bg-white py-2.5 text-center'
                  return canFill ? (
                    <Link key={r.id} to={`/maintenance/check/${r.id}`} data-room={r.number} className={`${cls} active:bg-amber-50`}>{body}</Link>
                  ) : (
                    <div key={r.id} data-room={r.number} className={cls}>{body}</div>
                  )
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
