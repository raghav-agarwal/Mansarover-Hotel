// Pure report calculations over submitted maintenance checks (no database access).

const newestFirst = (a, b) => b.date.localeCompare(a.date) || (b.submittedAt || 0) - (a.submittedAt || 0)

export function groupByRoom(checks) {
  const g = {}
  for (const c of checks) (g[c.roomId] ||= []).push(c)
  for (const list of Object.values(g)) list.sort(newestFirst)
  return g
}

// Problems found in the newest check, each with how long it has been failing:
// `streak` = consecutive checks (newest backwards) in which the same item was marked ✗, `since` = first of them.
// `roomChecks` must be newest first.
export function currentIssues(roomChecks) {
  const latest = roomChecks[0]
  if (!latest) return []
  return latest.items
    .filter((i) => i.ok === false)
    .map((i) => {
      let streak = 0
      let since = latest.date
      for (const c of roomChecks) {
        const same = c.items.find((x) => x.id === i.id)
        if (same && same.ok === false) {
          streak += 1
          since = c.date
        } else break
      }
      return { id: i.id, section: i.section, label: i.label, remark: i.remark, since, streak }
    })
}

// Active rooms whose newest check still has a ✗. A later all-OK check clears the room automatically.
export function openIssues(rooms, checks) {
  const g = groupByRoom(checks)
  return rooms
    .filter((r) => r.active !== false && g[r.id])
    .map((r) => ({ room: r, latest: g[r.id][0], issues: currentIssues(g[r.id]) }))
    .filter((x) => x.issues.length > 0)
}

// How often each item failed across the given checks (any order).
export function itemStats(checks) {
  const asc = [...checks].sort((a, b) => -newestFirst(a, b))
  const m = new Map()
  for (const c of asc) {
    for (const i of c.items) {
      const s = m.get(i.id) || { id: i.id, section: i.section, label: i.label, checks: 0, fails: 0, lastFail: null }
      s.checks += 1
      s.label = i.label // newest name wins
      if (i.ok === false) {
        s.fails += 1
        s.lastFail = { date: c.date, remark: i.remark }
      }
      m.set(i.id, s)
    }
  }
  return [...m.values()].filter((s) => s.fails > 0).sort((a, b) => b.fails - a.fails || b.fails / b.checks - a.fails / a.checks)
}

export function csvText(rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return rows.map((r) => r.map(q).join(',')).join('\n')
}

export function downloadCsv(filename, rows) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv' }))
  a.download = filename
  a.click()
}
