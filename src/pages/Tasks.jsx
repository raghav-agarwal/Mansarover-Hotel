import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/AuthContext'
import TaskCard from '../components/TaskCard'
import { PRIORITY, sortTasks } from '../lib/tasks'

const field =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200'

const TABS = [
  { id: 'mine', label: 'Assigned to me' },
  { id: 'created', label: 'Created by me' },
  { id: 'all', label: 'All' },
]

export default function Tasks() {
  const { user: me } = useAuth()
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('mine')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(
    () => onSnapshot(collection(db, 'tasks'), (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    []
  )
  useEffect(
    () =>
      onSnapshot(collection(db, 'users'), (s) =>
        setUsers(
          s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.active !== false)
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      ),
    []
  )

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function openNew() {
    setForm({ title: '', description: '', priority: 'medium', assignedTo: me.id, dueDate: '' })
    setError('')
    setAdding(true)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Title is required.')
    const assignee = users.find((u) => u.id === form.assignedTo)
    if (!assignee) return setError('Pick who this task is for.')
    setBusy(true)
    try {
      await addDoc(collection(db, 'tasks'), {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: 'open',
        dueDate: form.dueDate || '',
        assignedTo: assignee.id,
        assignedToName: assignee.name,
        createdBy: me.id,
        createdByName: me.name,
        createdAt: Date.now(),
      })
      setAdding(false)
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const shown = sortTasks(
    tasks.filter((t) => (tab === 'mine' ? t.assignedTo === me.id : tab === 'created' ? t.createdBy === me.id : true))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <button onClick={openNew} className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm font-medium text-white active:bg-amber-900">
          + New task
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium ${tab === t.id ? 'bg-white shadow-sm' : 'text-stone-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-stone-400">No tasks here.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => <TaskCard key={t.id} task={t} me={me} showAssignee={tab !== 'mine'} />)}
        </ul>
      )}

      {adding && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
          <form onSubmit={save}
            className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <h3 className="text-lg font-semibold">New task</h3>
            <input className={field} placeholder="Title" value={form.title} onChange={set('title')} autoFocus />
            <textarea className={field} rows={3} placeholder="Description (optional)"
              value={form.description} onChange={set('description')} />
            <label className="block text-sm text-stone-600">Assign to
              <select className={`${field} mt-1`} value={form.assignedTo} onChange={set('assignedTo')}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.id === me.id ? `${u.name} (me)` : u.name}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <label className="block flex-1 text-sm text-stone-600">Priority
                <select className={`${field} mt-1`} value={form.priority} onChange={set('priority')}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="block flex-1 text-sm text-stone-600">Due date
                <input type="date" className={`${field} mt-1`} value={form.dueDate} onChange={set('dueDate')} />
              </label>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setAdding(false)}
                className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Cancel</button>
              <button type="submit" disabled={busy}
                className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white disabled:opacity-60">
                {busy ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
