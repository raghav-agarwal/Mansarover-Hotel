import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { addDays, prettyDate, todayIST } from '../lib/dates'
import { STATUS } from '../lib/summary'

export default function SummaryList() {
  const [byDate, setByDate] = useState({})
  const today = todayIST()

  useEffect(
    () =>
      onSnapshot(collection(db, 'dailySummaries'), (snap) =>
        setByDate(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])))
      ),
    []
  )

  const days = Array.from({ length: 30 }, (_, i) => addDays(today, -i))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Daily Summary</h2>
        <Link to={`/summary/month/${today.slice(0, 7)}`}
          className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium">Monthly table</Link>
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
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[st].cls}`}>
                  {STATUS[st].label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
