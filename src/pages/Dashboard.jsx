import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/AuthContext'
import { can } from '../lib/roles'
import { isDuePassed, prettyDate, yesterdayIST } from '../lib/dates'
import TaskCard from '../components/TaskCard'
import { sortTasks } from '../lib/tasks'

export default function Dashboard() {
  const { user } = useAuth()
  const showSummary = can(user, 'summary')
  const yesterday = yesterdayIST()

  const [yStatus, setYStatus] = useState(undefined) // undefined = loading
  const [awaiting, setAwaiting] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [, tick] = useState(0)

  // Re-check the clock every minute so the warning appears at 10:00 without a reload.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!showSummary) return
    return onSnapshot(doc(db, 'dailySummaries', yesterday), (s) =>
      setYStatus(s.exists() ? s.data().status : 'missing')
    )
  }, [showSummary, yesterday])

  useEffect(() => {
    if (user.role !== 'management') return
    return onSnapshot(query(collection(db, 'dailySummaries'), where('status', '==', 'submitted')), (snap) =>
      setAwaiting(snap.docs.map((d) => d.id).sort().reverse())
    )
  }, [user.role])

  useEffect(
    () =>
      onSnapshot(query(collection(db, 'tasks'), where('assignedTo', '==', user.id)), (snap) =>
        setMyTasks(sortTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.status !== 'done')))
      ),
    [user.id]
  )

  // Pending = yesterday not yet submitted (missing or still draft), after 10:00 AM IST.
  const pending = showSummary && isDuePassed() && (yStatus === 'missing' || yStatus === 'draft')

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Hello, {user.name.split(' ')[0]}</h2>

      {pending && (
        <Link to={`/summary/${yesterday}`}
          className="block rounded-2xl border border-red-300 bg-red-50 p-4 active:bg-red-100">
          <p className="font-semibold text-red-800">⚠ Daily summary pending</p>
          <p className="mt-0.5 text-sm text-red-700">
            {prettyDate(yesterday)} is {yStatus === 'draft' ? 'still a draft' : 'not filled'}. It was due at 10:00 AM.
            Tap to {user.role === 'accountant' ? 'complete it' : 'open it'}.
          </p>
        </Link>
      )}

      {showSummary && !pending && yStatus !== undefined && isDuePassed() && (
        <p className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">
          ✓ Yesterday's summary ({prettyDate(yesterday)}) is in.
        </p>
      )}

      {awaiting.length > 0 && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-semibold text-blue-900">Waiting for your verification</p>
          <ul className="mt-2 space-y-1">
            {awaiting.map((d) => (
              <li key={d}>
                <Link to={`/summary/${d}`} className="text-sm text-blue-800 underline">{prettyDate(d)}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">My tasks</h3>
          <Link to="/tasks" className="text-sm text-amber-800">See all</Link>
        </div>
        {myTasks.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-stone-400">Nothing pending. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {myTasks.slice(0, 5).map((t) => <TaskCard key={t.id} task={t} me={user} />)}
          </ul>
        )}
      </section>
    </div>
  )
}
