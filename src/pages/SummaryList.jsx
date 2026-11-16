import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { addDays, prettyDate, todayIST } from '../lib/dates'
import { FINANCE_KEYS, STATUS, financeVerifiedCount, isUnverified } from '../lib/summary'

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1 + delta, 1)).toISOString().slice(0, 7)
}

export default function SummaryList() {
  const today = todayIST()
  const thisMonth = today.slice(0, 7)
  const [month, setMonth] = useState(() => {
    try {
      return sessionStorage.getItem('summaryMonth') || thisMonth
    } catch {
      return thisMonth
    }
  })
  const [byDate, setByDate] = useState({})

  const pick = (m) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m) || m > thisMonth) return
    setMonth(m)
    try {
      sessionStorage.setItem('summaryMonth', m)
    } catch {
      // storage unavailable: selection just won't be remembered
    }
  }

  useEffect(() => {
    const q = query(
      collection(db, 'dailySummaries'),
      where('date', '>=', `${month}-01`),
      where('date', '<=', `${month}-31`)
    )
    return onSnapshot(q, (snap) => setByDate(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))))
  }, [month])

  // Days of the chosen month, newest first, never beyond today.
  const days = useMemo(() => {
    const out = []
    for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) if (d <= today) out.push(d)
    return out.reverse()
  }, [month, today])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Daily Summary</h2>
        <Link to={`/summary/month/${month}`}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium">Monthly table</Link>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => pick(shiftMonth(month, -1))}
          className="rounded-lg bg-stone-100 px-3 py-2 text-lg" aria-label="Previous month">‹</button>
        <input type="month" value={month} max={thisMonth} onChange={(e) => pick(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-center text-base font-medium" />
        <button onClick={() => pick(shiftMonth(month, 1))} disabled={month >= thisMonth}
          className="rounded-lg bg-stone-100 px-3 py-2 text-lg disabled:opacity-30" aria-label="Next month">›</button>
      </div>

      <ul className="space-y-2">
        {days.map((d) => {
          const st = byDate[d]?.status || 'missing'
          return (
            <li key={d}>
              <Link to={`/summary/${d}`}
                className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3 active:bg-stone-50">
                <span>
                  {prettyDate(d)}
                  {d === today && <span className="ml-2 text-xs text-stone-400">today</span>}
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[st].cls}`}>
                    {STATUS[st].label}
                  </span>
                  {isUnverified(byDate[d]) && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Unverified · {financeVerifiedCount(byDate[d])}/{FINANCE_KEYS.length} finance
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
