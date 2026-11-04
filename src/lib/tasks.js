export const PRIORITY = {
  high: { label: 'High', cls: 'bg-red-100 text-red-700', rank: 0 },
  medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-800', rank: 1 },
  low: { label: 'Low', cls: 'bg-stone-200 text-stone-700', rank: 2 },
}

export const TASK_STATUS = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
}

// Open work first, then by priority, then earliest due date, then newest.
export function sortTasks(list) {
  return [...list].sort((a, b) => {
    const da = a.status === 'done' ? 1 : 0
    const dbb = b.status === 'done' ? 1 : 0
    if (da !== dbb) return da - dbb
    const p = PRIORITY[a.priority].rank - PRIORITY[b.priority].rank
    if (p) return p
    if (a.dueDate !== b.dueDate) return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}
