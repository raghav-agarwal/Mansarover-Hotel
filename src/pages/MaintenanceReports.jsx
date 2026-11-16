import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useChecks, useMaintenance } from '../lib/useMaintenance'
import { SECTIONS, compareRooms, roomKey } from '../lib/maintenance'
import { ageLabel, prettyDate } from '../lib/dates'
import { currentIssues, downloadCsv, groupByRoom, itemStats, openIssues } from '../lib/maintenanceReports'
import MaintNav from '../components/maintenance/MaintNav'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

const shortDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

export default function MaintenanceReports() {
  const { loading, types, rooms } = useMaintenance()
  const { loading: loadingChecks, checks } = useChecks()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'room' ? 'room' : 'open'

  const setParam = (changes, replace = true) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k))
      return next
    }, { replace })

  if (loading || loadingChecks) return <p className="text-stone-500">Loading…</p>

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Maintenance</h2>
      <MaintNav />
      <div className="flex gap-1 rounded-xl border border-stone-200 p-1">
        {[['open', 'Open issues'], ['room', 'By room']].map(([id, label]) => (
          <button key={id} onClick={() => setParam({ view: id === 'room' ? 'room' : '' })}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${view === id ? 'bg-amber-800 text-white' : 'text-stone-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {view === 'open'
        ? <OpenIssues types={types} rooms={rooms} checks={checks} />
        : <RoomReport types={types} rooms={rooms} checks={checks} params={params} setParam={setParam} />}
    </div>
  )
}

function OpenIssues({ types, rooms, checks }) {
  const [params, setParams] = useSearchParams()
  const typeFilter = params.get('type') || 'all'
  const search = params.get('q') || ''
  const set = (k, v) => setParams((p) => { const n = new URLSearchParams(p); v && v !== 'all' ? n.set(k, v) : n.delete(k); return n }, { replace: true })

  const typeName = (id) => types.find((t) => t.id === id)?.name || ''
  const all = useMemo(() => openIssues(rooms, checks), [rooms, checks])
  const shown = useMemo(() => {
    const q = roomKey(search)
    return all
      .filter((x) => typeFilter === 'all' || x.room.typeId === typeFilter)
      .filter((x) => !q || roomKey(x.room.number).includes(q))
      .sort((a, b) => a.latest.date.localeCompare(b.latest.date) || compareRooms(a.room.number, b.room.number)) // oldest first
  }, [all, typeFilter, search])
  const issueTotal = shown.reduce((n, x) => n + x.issues.length, 0)

  function exportCsv() {
    const rows = [['Room', 'Type', 'Last checked', 'Section', 'Item', 'Remark', 'Failing since', 'Checks in a row']]
    shown.forEach((x) =>
      x.issues.forEach((i) =>
        rows.push([x.room.number, typeName(x.room.typeId), x.latest.date, SECTIONS[i.section], i.label, i.remark, i.since, i.streak])
      )
    )
    downloadCsv('maintenance-open-issues.csv', rows)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className={field} placeholder="Find room no." value={search} onChange={(e) => set('q', e.target.value)} />
        <select className={`${field} max-w-[45%]`} value={typeFilter} onChange={(e) => set('type', e.target.value)}>
          <option value="all">All types</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-600" data-testid="open-summary">
          <b>{shown.length}</b> room(s) · <b>{issueTotal}</b> open issue(s)
        </p>
        <button onClick={exportCsv} disabled={!shown.length} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium disabled:opacity-40">Export CSV</button>
      </div>

      {shown.length === 0 && (
        <p className="rounded-2xl bg-green-50 p-5 text-center text-green-800">
          {all.length === 0 ? '✓ No open issues. Every room’s latest check is clear.' : 'No rooms match the filters.'}
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((x) => (
          <li key={x.room.id} data-room={x.room.number} className="rounded-2xl border border-red-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold">Room {x.room.number}</h3>
              <span className="text-xs text-stone-500">{typeName(x.room.typeId)}</span>
            </div>
            <p className="text-xs text-stone-500">Last checked {shortDate(x.latest.date)} ({ageLabel(x.latest.date)}) by {x.latest.filledBy}</p>
            <ul className="mt-2 space-y-2">
              {x.issues.map((i) => (
                <li key={i.id} data-issue={i.label} className="rounded-xl bg-red-50 px-3 py-2 text-sm">
                  <span className="font-medium text-red-900">{SECTIONS[i.section]} · {i.label}</span>
                  <span className="block text-red-800">{i.remark}</span>
                  {i.streak > 1 && (
                    <span className="mt-0.5 block text-xs text-red-600">Failing since {shortDate(i.since)} · {i.streak} checks in a row</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-3 text-sm">
              <Link to={`/maintenance/view/${x.latest.id}`} className="text-amber-800">Open checklist</Link>
              <Link to={`/maintenance/reports?view=room&room=${x.room.id}`} className="text-amber-800">Room report →</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoomReport({ types, rooms, checks, params, setParam }) {
  const roomId = params.get('room') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const room = rooms.find((r) => r.id === roomId)
  const typeName = (id) => types.find((t) => t.id === id)?.name || ''

  const selectable = useMemo(
    () => rooms.filter((r) => r.active !== false || checks.some((c) => c.roomId === r.id))
      .sort((a, b) => compareRooms(a.number, b.number)),
    [rooms, checks]
  )

  const allForRoom = useMemo(() => (room ? groupByRoom(checks)[room.id] || [] : []), [room, checks])
  const inRange = useMemo(
    () => allForRoom.filter((c) => (!from || c.date >= from) && (!to || c.date <= to)),
    [allForRoom, from, to]
  )
  const issuesNow = useMemo(() => currentIssues(allForRoom), [allForRoom]) // always the newest check, whatever the range
  const stats = useMemo(() => itemStats(inRange), [inRange])
  const withIssues = inRange.filter((c) => c.items.some((i) => i.ok === false)).length

  function exportCsv() {
    const rows = [['Room', 'Date', 'Filled by', 'Section', 'Item', 'Result', 'Remark']]
    ;[...inRange].reverse().forEach((c) =>
      c.items.forEach((i) =>
        rows.push([room.number, c.date, c.filledBy, SECTIONS[i.section], i.label, i.ok ? 'OK' : 'Problem', i.remark])
      )
    )
    downloadCsv(`maintenance-room-${roomKey(room.number)}.csv`, rows)
  }

  return (
    <div className="space-y-3">
      <select className={field} value={roomId} onChange={(e) => setParam({ room: e.target.value })} aria-label="Room">
        <option value="">Choose a room…</option>
        {types.map((t) => {
          const list = selectable.filter((r) => r.typeId === t.id)
          return list.length > 0 && (
            <optgroup key={t.id} label={t.name}>
              {list.map((r) => <option key={r.id} value={r.id}>Room {r.number}{r.active === false ? ' (inactive)' : ''}</option>)}
            </optgroup>
          )
        })}
      </select>

      {!room ? (
        <p className="py-8 text-center text-stone-400">Pick a room to see its report.</p>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <label className="flex-1 text-xs text-stone-500">From
              <input type="date" className={`${field} mt-1`} value={from} onChange={(e) => setParam({ from: e.target.value })} />
            </label>
            <label className="flex-1 text-xs text-stone-500">To
              <input type="date" className={`${field} mt-1`} value={to} onChange={(e) => setParam({ to: e.target.value })} />
            </label>
            {(from || to) && (
              <button onClick={() => setParam({ from: '', to: '' })} className="rounded-xl bg-stone-100 px-3 py-2.5 text-sm">Clear</button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center" data-testid="room-stats">
            <div className="rounded-2xl bg-white p-3">
              <p className="text-2xl font-semibold" data-stat="checks">{inRange.length}</p>
              <p className="text-xs text-stone-500">checks{from || to ? ' in range' : ''}</p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-2xl font-semibold" data-stat="with-issues">{withIssues}</p>
              <p className="text-xs text-stone-500">with issues</p>
            </div>
            <div className="rounded-2xl bg-white p-3">
              <p className="text-sm font-semibold leading-8" data-stat="last">{allForRoom[0] ? shortDate(allForRoom[0].date) : '–'}</p>
              <p className="text-xs text-stone-500">last checked</p>
            </div>
          </div>
          <p className="text-xs text-stone-500">{room.number} · {typeName(room.typeId)}{room.active === false && ' · inactive'}</p>

          <section className="rounded-2xl border border-stone-200 bg-white p-4" data-section="now">
            <h3 className="mb-2 font-semibold text-amber-900">Open issues now</h3>
            {allForRoom.length === 0 ? (
              <p className="text-sm text-stone-400">This room has not been checked yet.</p>
            ) : issuesNow.length === 0 ? (
              <p className="text-sm text-green-700">✓ None. Latest check ({shortDate(allForRoom[0].date)}) was all OK.</p>
            ) : (
              <ul className="space-y-2">
                {issuesNow.map((i) => (
                  <li key={i.id} data-issue={i.label} className="rounded-xl bg-red-50 px-3 py-2 text-sm">
                    <span className="font-medium text-red-900">{SECTIONS[i.section]} · {i.label}</span>
                    <span className="block text-red-800">{i.remark}</span>
                    {i.streak > 1 && <span className="block text-xs text-red-600">Failing since {shortDate(i.since)} · {i.streak} checks in a row</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4" data-section="frequency">
            <h3 className="mb-2 font-semibold text-amber-900">Items that failed</h3>
            {stats.length === 0 ? (
              <p className="text-sm text-stone-400">No failed items{from || to ? ' in this range' : ''}.</p>
            ) : (
              <ul className="space-y-3">
                {stats.map((s) => (
                  <li key={s.id} data-item={s.label}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium">{s.label} <span className="text-xs font-normal text-stone-400">{SECTIONS[s.section]}</span></span>
                      <span className="shrink-0 text-xs text-stone-600" data-count>{s.fails} of {s.checks} checks</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full bg-red-500" style={{ width: `${(s.fails / s.checks) * 100}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">Last: {shortDate(s.lastFail.date)} · {s.lastFail.remark}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-4" data-section="history">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-amber-900">Past checks</h3>
              <button onClick={exportCsv} disabled={!inRange.length} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium disabled:opacity-40">Export CSV</button>
            </div>
            {inRange.length === 0 ? (
              <p className="text-sm text-stone-400">No checks{from || to ? ' in this range' : ''}.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {inRange.map((c) => {
                  const n = c.items.filter((i) => i.ok === false).length
                  return (
                    <li key={c.id}>
                      <Link to={`/maintenance/view/${c.id}`} data-check={c.date} className="flex items-center justify-between py-2.5">
                        <span>
                          <span className="block text-sm font-medium">{prettyDate(c.date)}</span>
                          <span className="block text-xs text-stone-500">by {c.filledBy}</span>
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${n ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>
                          {n ? `${n} issue(s)` : 'All OK'}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
