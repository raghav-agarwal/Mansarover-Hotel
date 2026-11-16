import { Link, useNavigate, useParams } from 'react-router-dom'
import { useChecks } from '../lib/useMaintenance'
import { SECTIONS } from '../lib/maintenance'
import { prettyDate } from '../lib/dates'

// Read-only view of one submitted checklist, exactly as it was filled.
export default function MaintenanceCheckView() {
  const { checkId } = useParams()
  const navigate = useNavigate()
  const { loading, checks } = useChecks()

  if (loading) return <p className="text-stone-500">Loading…</p>
  const c = checks.find((x) => x.id === checkId)
  if (!c) {
    return (
      <div className="space-y-3">
        <p className="text-stone-600">That checklist was not found.</p>
        <Link to="/maintenance/history" className="text-amber-800">← History</Link>
      </div>
    )
  }

  const issues = c.items.filter((i) => i.ok === false)

  return (
    <div className="space-y-4">
      <div>
        <button onClick={() => navigate(-1)} className="text-sm text-amber-800">← Back</button>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Room {c.roomNumber}</h2>
          <span className="text-sm text-stone-500">{c.typeName}</span>
        </div>
        <p className="text-sm text-stone-600">{prettyDate(c.date)} · filled by {c.filledBy}</p>
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${issues.length ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}`}>
          {issues.length ? `${issues.length} issue(s)` : 'All OK'} · {c.items.length} items
        </p>
      </div>

      {issues.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 font-semibold text-red-800">Issues</h3>
          <ul className="space-y-2">
            {issues.map((i) => (
              <li key={i.id} className="text-sm">
                <span className="font-medium">{SECTIONS[i.section]} · {i.label}</span>
                <span className="block text-red-700">{i.remark}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.entries(SECTIONS).map(([section, title]) => {
        const rows = c.items.filter((i) => i.section === section)
        if (!rows.length) return null
        return (
          <section key={section} className="rounded-2xl border border-stone-200 bg-white p-4">
            <h3 className="mb-2 font-semibold text-amber-900">{title}</h3>
            <ul className="divide-y divide-stone-100">
              {rows.map((i) => (
                <li key={i.id} className="flex items-start gap-3 py-2">
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm font-bold text-white ${i.ok ? 'bg-green-600' : 'bg-red-600'}`}>
                    {i.ok ? '✓' : '✗'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{i.label}</span>
                    {i.ok === false && i.remark && <span className="block text-sm text-red-700">{i.remark}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
