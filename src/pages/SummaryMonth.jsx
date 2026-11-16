import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { addDays, todayIST } from '../lib/dates'
import { FINANCE_KEYS, STATUS, financeVerifiedCount, isUnverified } from '../lib/summary'

const COLS = [
  { key: 'occupied', label: 'Occupied', avg: true },
  { key: 'checkOut', label: 'Out' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'foodSale', label: 'Food ₹', money: true },
  { key: 'buffet', label: 'Buffet' },
  { key: 'inHouseGuests', label: 'In-house' },
  { key: 'cashReceipt', label: 'Cash ₹', money: true },
  { key: 'upiReceipts', label: 'UPI ₹', money: true },
  { key: 'cardReceipts', label: 'Card ₹', money: true },
  { key: 'bankTransfers', label: 'Bank ₹', money: true },
  { key: 'billToCompany', label: 'Bill to Co. ₹', money: true },
  { key: 'cashExpenses', label: 'Expenses ₹', money: true },
  { key: 'gen45Hrs', label: '45KW hrs', dec: true },
  { key: 'gen82Hrs', label: '82KW hrs', dec: true },
]

const fmt = (v, c) => {
  if (v == null || v === '') return '–'
  const n = Number(v)
  return c.money ? n.toLocaleString('en-IN') : c.dec ? String(Math.round(n * 100) / 100) : String(n)
}

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export default function SummaryMonth() {
  const { month } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState({})
  const today = todayIST()
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)

  useEffect(() => {
    if (!valid) return
    const q = query(
      collection(db, 'dailySummaries'),
      where('date', '>=', `${month}-01`),
      where('date', '<=', `${month}-31`)
    )
    return onSnapshot(q, (snap) => setRows(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))))
  }, [month, valid])

  const days = useMemo(() => {
    if (!valid) return []
    const out = []
    for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) out.push(d)
    return out
  }, [month, valid])

  if (!valid) return <p className="text-stone-500">That month isn't valid.</p>

  const filled = days.filter((d) => rows[d] && rows[d].status !== 'missing')
  const sum = (k) => filled.reduce((a, d) => a + (Number(rows[d][k]) || 0), 0)
  const avgOcc = filled.length ? sum('occupied') / filled.length : null

  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  })
  const nextDisabled = shiftMonth(month, 1) > today.slice(0, 7)

  function exportCsv() {
    const head = ['Date', ...COLS.map((c) => c.label), 'Status']
    const lines = days.map((d) => [
      d, ...COLS.map((c) => rows[d]?.[c.key] ?? ''), rows[d]?.status || 'missing',
    ])
    lines.push(['Total', ...COLS.map((c) => (c.avg ? '' : sum(c.key))), ''])
    const csv = [head, ...lines].map((r) => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `mansarover-summary-${month}.csv`
    a.click()
  }

  return (
    <div className="space-y-3">
      <Link to="/summary" className="text-sm text-amber-800">← All summaries</Link>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate(`/summary/month/${shiftMonth(month, -1)}`)}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-lg">‹</button>
        <h2 className="text-lg font-semibold">{label}</h2>
        <button disabled={nextDisabled} onClick={() => navigate(`/summary/month/${shiftMonth(month, 1)}`)}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-lg disabled:opacity-30">›</button>
      </div>

      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>{filled.length} of {days.length} days filled</span>
        <button onClick={exportCsv} className="rounded-lg bg-stone-100 px-3 py-1.5 font-medium text-stone-800">
          Export CSV
        </button>
      </div>

      {/* Table scrolls sideways on phones; date column stays pinned. */}
      <div className="-mx-4 overflow-x-auto border-y border-stone-200 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-amber-100 text-left text-xs text-amber-900">
              <th className="sticky left-0 z-10 bg-amber-100 px-3 py-2">Date</th>
              {COLS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 text-right">{c.label}</th>
              ))}
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const r = rows[d]
              const st = r?.status || 'missing'
              const future = d > today
              return (
                <tr key={d} className={future ? 'opacity-40' : st === 'missing' ? 'bg-red-50/60' : ''}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-stone-100 bg-white px-3 py-2 font-medium">
                    <Link to={`/summary/${d}`} className="text-amber-800 underline">
                      {d.slice(8)} {new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short' })}
                    </Link>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="whitespace-nowrap border-b border-stone-100 px-3 py-2 text-right tabular-nums">
                      {fmt(r?.[c.key], c)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap border-b border-stone-100 px-3 py-2">
                    {!future && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[st].cls}`}>{STATUS[st].label}</span>
                    )}
                    {!future && isUnverified(r) && (
                      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        Unverified {financeVerifiedCount(r)}/{FINANCE_KEYS.length}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-stone-100 font-semibold">
              <td className="sticky left-0 z-10 bg-stone-100 px-3 py-2">Total</td>
              {COLS.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {c.avg ? '–' : fmt(sum(c.key), c)}
                </td>
              ))}
              <td />
            </tr>
            <tr className="bg-stone-50 text-stone-600">
              <td className="sticky left-0 z-10 bg-stone-50 px-3 py-2">Avg/day</td>
              {COLS.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {filled.length ? (Math.round((sum(c.key) / filled.length) * 10) / 10).toLocaleString('en-IN') : '–'}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {avgOcc != null && (
        <p className="text-sm text-stone-600">Average rooms occupied per day: <b>{Math.round(avgOcc * 10) / 10}</b></p>
      )}
    </div>
  )
}
