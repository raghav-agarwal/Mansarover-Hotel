import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChecks, useMaintenance } from '../lib/useMaintenance'
import { compareRooms, roomKey } from '../lib/maintenance'
import { todayIST } from '../lib/dates'
import MaintNav from '../components/maintenance/MaintNav'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

export default function MaintenanceHistory() {
  const { loading, types, rooms } = useMaintenance()
  const { loading: loadingChecks, checks } = useChecks()
  const today = todayIST()
  const thisYear = Number(today.slice(0, 4))
  const thisMonth = today.slice(0, 7)
  const [year, setYear] = useState(thisYear)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const scrollRef = useRef(null)
  const monthKeys = MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  // roomId -> month key -> checks (oldest first)
  const grid = useMemo(() => {
    const g = {}
    for (const c of checks) {
      if (!c.date?.startsWith(`${year}-`)) continue
      const m = (g[c.roomId] ||= {})
      ;(m[c.month || c.date.slice(0, 7)] ||= []).push(c)
    }
    for (const m of Object.values(g)) for (const list of Object.values(m)) {
      list.sort((a, b) => a.date.localeCompare(b.date) || (a.submittedAt || 0) - (b.submittedAt || 0))
    }
    return g
  }, [checks, year])

  const typeOrder = useMemo(() => Object.fromEntries(types.map((t, i) => [t.id, i])), [types])
  const typeName = (id) => types.find((t) => t.id === id)?.name || ''

  const rows = useMemo(() => {
    const q = roomKey(search)
    return rooms
      // Inactive rooms stay visible only while they have history this year.
      .filter((r) => r.active !== false || grid[r.id])
      .filter((r) => typeFilter === 'all' || r.typeId === typeFilter)
      .filter((r) => !q || roomKey(r.number).includes(q))
      .sort((a, b) => (typeOrder[a.typeId] ?? 99) - (typeOrder[b.typeId] ?? 99) || compareRooms(a.number, b.number))
  }, [rooms, grid, typeFilter, search, typeOrder])

  // On a phone only ~5 months fit, so bring the current month into view (past years start at January).
  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    const th = box.querySelector('th[data-current]')
    box.scrollLeft = th ? Math.max(0, th.offsetLeft - 130) : 0
  }, [loading, loadingChecks, year])

  if (loading || loadingChecks) return <p className="text-stone-500">Loading…</p>

  const listFor = (r, key) => grid[r.id]?.[key] || []
  const roomsChecked = (key) => rows.filter((r) => listFor(r, key).length).length
  const checkCount = (key) => rows.reduce((n, r) => n + listFor(r, key).length, 0)

  function exportCsv() {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`
    const head = ['Room', 'Type', ...MONTHS.map((m) => `${m} ${year}`)]
    const lines = rows.map((r) => [r.number, typeName(r.typeId), ...monthKeys.map((k) => listFor(r, k).map((c) => c.date).join('; '))])
    const csv = [head, ...lines].map((l) => l.map(q).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `maintenance-history-${year}.csv`
    a.click()
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Maintenance</h2>
      <MaintNav />

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setYear((y) => y - 1)} aria-label="Previous year" className="rounded-lg bg-stone-100 px-3 py-1.5 text-lg">‹</button>
        <span className="text-lg font-semibold" data-testid="year">{year}</span>
        <button onClick={() => setYear((y) => y + 1)} disabled={year >= thisYear} aria-label="Next year"
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-lg disabled:opacity-30">›</button>
      </div>

      <div className="flex gap-2">
        <input className={field} placeholder="Find room no." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={`${field} max-w-[45%]`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between text-xs text-stone-500">
        <span className="flex flex-wrap gap-x-3">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-green-200" />all OK</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-red-200" />issues</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-100" />not yet this month</span>
        </span>
        <button onClick={exportCsv} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-800">Export CSV</button>
      </div>

      {/* Scrolls sideways on phones; the room column stays pinned. */}
      <div ref={scrollRef} className="-mx-4 overflow-x-auto border-y border-stone-200 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-amber-100 text-xs text-amber-900">
              <th className="sticky left-0 z-10 min-w-[76px] bg-amber-100 px-3 py-2 text-left">Room</th>
              {MONTHS.map((m, i) => (
                <th key={m} data-current={monthKeys[i] === thisMonth ? '1' : undefined} className={`min-w-[52px] px-2 py-2 text-center ${monthKeys[i] === thisMonth ? 'bg-amber-300' : ''}`}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-room={r.number}>
                <td className="sticky left-0 z-10 whitespace-nowrap border-b border-stone-100 bg-white px-3 py-1.5">
                  <span className={`font-medium ${r.active === false ? 'text-stone-400' : ''}`}>{r.number}</span>
                  <span className="block text-[10px] leading-tight text-stone-400">{typeName(r.typeId)}</span>
                </td>
                {monthKeys.map((key) => {
                  const list = listFor(r, key)
                  const missing = key === thisMonth && r.active !== false && list.length === 0
                  return (
                    <td key={key} data-month={key} data-missing={missing ? '1' : undefined}
                      className={`border-b border-stone-100 px-1 py-1.5 text-center align-top ${missing ? 'bg-amber-100' : ''} ${key > thisMonth ? 'bg-stone-50' : ''}`}>
                      {list.length > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          {list.map((c) => (
                            <Link key={c.id} to={`/maintenance/view/${c.id}`} title={`${c.date}${c.failCount ? ` · ${c.failCount} issue(s)` : ''}`}
                              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${c.failCount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>
                              {Number(c.date.slice(8))}
                            </Link>
                          ))}
                        </div>
                      ) : missing ? (
                        <span className="text-amber-500">–</span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={13} className="py-8 text-center text-stone-400">No rooms match.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-stone-100 text-xs font-semibold" data-row="rooms-checked">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-stone-100 px-3 py-2">Rooms checked</td>
              {monthKeys.map((k) => <td key={k} data-month={k} className="px-1 py-2 text-center tabular-nums">{roomsChecked(k) || ''}</td>)}
            </tr>
            <tr className="bg-stone-50 text-xs text-stone-600" data-row="checks">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-stone-50 px-3 py-2">Checks</td>
              {monthKeys.map((k) => <td key={k} data-month={k} className="px-1 py-2 text-center tabular-nums">{checkCount(k) || ''}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-stone-500">Each number is the day of the month a checklist was filled. Tap one to open it.</p>
    </div>
  )
}
