import { deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { todayIST, prettyDate } from '../lib/dates'
import { PRIORITY, TASK_STATUS } from '../lib/tasks'

export default function TaskCard({ task, me, showAssignee }) {
  const mine = task.assignedTo === me.id
  const canDelete = task.createdBy === me.id || me.role === 'management'
  const overdue = task.dueDate && task.status !== 'done' && task.dueDate < todayIST()

  const setStatus = (e) => updateDoc(doc(db, 'tasks', task.id), { status: e.target.value })
  const remove = () => {
    if (confirm(`Delete "${task.title}"?`)) deleteDoc(doc(db, 'tasks', task.id))
  }

  return (
    <li className={`rounded-2xl border bg-white p-4 ${task.status === 'done' ? 'opacity-60' : 'border-stone-200'} ${overdue ? 'border-red-300' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`font-medium ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY[task.priority].cls}`}>
          {PRIORITY[task.priority].label}
        </span>
      </div>
      {task.description && <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{task.description}</p>}
      <p className="mt-2 text-xs text-stone-500">
        {showAssignee && <>For {mine ? 'you' : task.assignedToName} · </>}
        From {task.createdBy === me.id ? 'you' : task.createdByName}
        {task.dueDate && (
          <span className={overdue ? 'font-medium text-red-600' : ''}> · Due {prettyDate(task.dueDate)}{overdue && ' (overdue)'}</span>
        )}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <select value={task.status} onChange={setStatus}
          className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm">
          {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {canDelete && (
          <button onClick={remove} className="ml-auto rounded-lg px-2 py-1.5 text-sm text-red-700">Delete</button>
        )}
      </div>
    </li>
  )
}
