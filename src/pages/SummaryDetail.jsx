import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/AuthContext'
import { prettyDate, todayIST } from '../lib/dates'
import { INPUT_KEYS, SECTIONS, STATUS, totalCheckIn } from '../lib/summary'

const input =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-right text-lg outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200 disabled:bg-stone-100 disabled:text-stone-600'

export default function SummaryDetail() {
  const { date } = useParams()
  const { user } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(null)
  const [vals, setVals] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= todayIST()

  useEffect(() => {
    setLoaded(false)
    return onSnapshot(doc(db, 'dailySummaries', date), (snap) => {
      const d = snap.exists() ? snap.data() : null
      setSaved(d)
      setVals(Object.fromEntries(INPUT_KEYS.map((k) => [k, d?.[k] ?? ''])))
      setLoaded(true)
    })
  }, [date])

  if (!valid) return <p className="text-stone-500">That date isn't valid.</p>
  if (!loaded) return <p className="text-stone-500">Loading…</p>

  const status = saved?.status || 'missing'
  const isAccountant = user.role === 'accountant'
  const isManagement = user.role === 'management'
  const editable = isAccountant && (status === 'missing' || status === 'draft')

  const num = (k) => (vals[k] === '' || vals[k] == null ? 0 : Number(vals[k]))
  const total = num('walkIn') + num('ota')

  const setVal = (k, decimal) => (e) => {
    const re = decimal ? /[^0-9.]/g : /\D/g
    setVals((v) => ({ ...v, [k]: e.target.value.replace(re, '') }))
  }

  async function write(patch, doneMsg) {
    setBusy(true)
    setMsg('')
    try {
      const data = Object.fromEntries(INPUT_KEYS.map((k) => [k, vals[k] === '' ? null : Number(vals[k])]))
      await setDoc(
        doc(db, 'dailySummaries', date),
        { date, ...data, totalCheckIn: total, updatedAt: serverTimestamp(), updatedBy: user.name, ...patch },
        { merge: true }
      )
      setMsg(doneMsg)
    } catch (e) {
      setMsg('Could not save: ' + (e.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => write({ status: 'draft' }, 'Draft saved.')

  function submit() {
    const blank = INPUT_KEYS.filter((k) => vals[k] === '')
    if (blank.length && !confirm(`${blank.length} field(s) are empty and will count as blank. Submit anyway?`)) return
    write({ status: 'submitted', submittedBy: user.name, submittedAt: serverTimestamp() }, 'Submitted.')
  }

  async function review(next) {
    setBusy(true)
    setMsg('')
    try {
      await setDoc(
        doc(db, 'dailySummaries', date),
        next === 'verified'
          ? { status: 'verified', verifiedBy: user.name, verifiedAt: serverTimestamp() }
          : { status: 'draft', verifiedBy: null, verifiedAt: null },
        { merge: true }
      )
      setMsg(next === 'verified' ? 'Verified.' : 'Sent back to the accountant as draft.')
    } catch (e) {
      setMsg('Could not save: ' + (e.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/summary" className="text-sm text-amber-800">← All summaries</Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{prettyDate(date)}</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS[status].cls}`}>
            {STATUS[status].label}
          </span>
        </div>
        {saved?.submittedBy && (
          <p className="text-xs text-stone-500">
            Submitted by {saved.submittedBy}
            {saved.verifiedBy ? ` · Verified by ${saved.verifiedBy}` : ''}
          </p>
        )}
      </div>

      {!editable && status === 'missing' && isManagement && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">The accountant hasn't filled this day yet.</p>
      )}
      {!editable && isAccountant && status !== 'missing' && status !== 'draft' && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          This summary is locked. Ask Management to send it back if it needs changes.
        </p>
      )}

      {SECTIONS.map((s) => (
        <section key={s.title} className="rounded-2xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 font-semibold text-amber-900">{s.title}</h3>
          <div className="space-y-3">
            {s.fields.map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-stone-700">{f.label}</span>
                <div className="w-36">
                  {f.auto ? (
                    <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-right text-lg font-semibold">{total}</div>
                  ) : (
                    <input className={input} inputMode={f.decimal || f.money ? 'decimal' : 'numeric'}
                      disabled={!editable} placeholder="0"
                      value={vals[f.key]} onChange={setVal(f.key, f.decimal || f.money)} />
                  )}
                </div>
              </label>
            ))}
          </div>
        </section>
      ))}

      {msg && <p className="rounded-xl bg-stone-100 p-3 text-sm">{msg}</p>}

      {editable && (
        <div className="flex gap-2">
          <button disabled={busy} onClick={saveDraft}
            className="flex-1 rounded-xl bg-stone-200 py-3 font-medium disabled:opacity-60">Save draft</button>
          <button disabled={busy} onClick={submit}
            className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white disabled:opacity-60">Submit</button>
        </div>
      )}

      {isManagement && status === 'submitted' && (
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => review('draft')}
            className="flex-1 rounded-xl bg-stone-200 py-3 font-medium disabled:opacity-60">Send back</button>
          <button disabled={busy} onClick={() => review('verified')}
            className="flex-1 rounded-xl bg-green-700 py-3 font-medium text-white disabled:opacity-60">Verify</button>
        </div>
      )}
      {isManagement && status === 'verified' && (
        <button disabled={busy} onClick={() => review('draft')}
          className="w-full rounded-xl bg-stone-200 py-3 font-medium disabled:opacity-60">Reopen as draft</button>
      )}
    </div>
  )
}
