import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { deleteField, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/AuthContext'
import NightAuditUpload from '../components/NightAuditUpload'
import { prettyDate, todayIST } from '../lib/dates'
import { FINANCE_KEYS, INPUT_KEYS, SECTIONS, STATUS, financeVerifiedCount, totalReceipts } from '../lib/summary'

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
  const ref = doc(db, 'dailySummaries', date)

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
  const fv = saved?.fieldVerified || {}
  const verifiedCount = financeVerifiedCount(saved)
  const allFinanceVerified = verifiedCount === FINANCE_KEYS.length
  // Management can verify finance fields once the day is submitted (and undo them while it is not yet fully verified).
  const canVerifyFields = isManagement && (status === 'submitted' || status === 'verified')

  const autoVals = { totalReceipts: Math.round(totalReceipts(vals) * 100) / 100 }

  const setVal = (k, decimal) => (e) => {
    const re = decimal ? /[^0-9.]/g : /\D/g
    setVals((v) => ({ ...v, [k]: e.target.value.replace(re, '') }))
  }

  async function run(fn, doneMsg) {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      if (doneMsg) setMsg(doneMsg)
    } catch (e) {
      setMsg('Could not save: ' + (e.message || 'unknown error'))
    } finally {
      setBusy(false)
    }
  }

  function write(patch, doneMsg, v = vals) {
    return run(async () => {
      const data = Object.fromEntries(INPUT_KEYS.map((k) => [k, v[k] === '' ? null : Number(v[k])]))
      // A finance field the accountant changed loses its verification.
      const cleared = {}
      for (const k of FINANCE_KEYS) {
        const before = saved?.[k] == null ? '' : Number(saved[k])
        const after = v[k] === '' ? '' : Number(v[k])
        if (fv[k] && before !== after) cleared[k] = deleteField()
      }
      const body = {
        date, ...data,
        totalReceipts: Math.round(totalReceipts(v) * 100) / 100,
        updatedAt: serverTimestamp(), updatedBy: user.name, ...patch,
      }
      if (Object.keys(cleared).length) body.fieldVerified = cleared
      await setDoc(ref, body, { merge: true })
    }, doneMsg)
  }

  const saveDraft = () => write({ status: 'draft' }, 'Draft saved.')

  // Night audit values go straight into the form and are saved as a draft, so nothing is lost
  // if the page refreshes. Tags show which fields came from the report (until they are edited).
  function applyAudit(fields, fileName) {
    const merged = { ...vals, ...Object.fromEntries(Object.entries(fields).map(([k, n]) => [k, String(n)])) }
    setVals(merged)
    write(
      { status: 'draft', fromAudit: fields, auditFile: fileName, auditAt: serverTimestamp() },
      'Night audit applied and saved as draft. Please review the values, then add the rest.',
      merged
    )
  }
  const fromAudit = saved?.fromAudit || {}

  function submit() {
    const blank = INPUT_KEYS.filter((k) => vals[k] === '')
    if (blank.length && !confirm(`${blank.length} field(s) are empty and will count as blank. Submit anyway?`)) return
    write({ status: 'submitted', submittedBy: user.name, submittedAt: serverTimestamp() }, 'Submitted.')
  }

  const review = (next) =>
    run(
      () =>
        setDoc(
          ref,
          next === 'verified'
            ? { status: 'verified', verifiedBy: user.name, verifiedAt: serverTimestamp() }
            : { status: 'draft', verifiedBy: null, verifiedAt: null },
          { merge: true }
        ),
      next === 'verified' ? 'Verified.' : 'Sent back to the accountant as draft.'
    )

  const verifyField = (k, on) =>
    run(() =>
      setDoc(
        ref,
        { fieldVerified: { [k]: on ? { by: user.name, at: Date.now() } : deleteField() } },
        { merge: true }
      )
    )

  const verifyAllFinance = () =>
    run(() =>
      setDoc(
        ref,
        { fieldVerified: Object.fromEntries(FINANCE_KEYS.filter((k) => !fv[k]).map((k) => [k, { by: user.name, at: Date.now() }])) },
        { merge: true }
      )
    )

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

      {editable && <NightAuditUpload date={date} onApply={applyAudit} disabled={busy} />}

      {SECTIONS.map((s) => {
        const isFinance = s.title === 'Finance'
        return (
          <section key={s.title} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-amber-900">{s.title}</h3>
              {isFinance && status !== 'missing' && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${allFinanceVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {verifiedCount}/{FINANCE_KEYS.length} verified
                </span>
              )}
            </div>
            <div className="space-y-3">
              {s.fields.map((f) => {
                const verifiable = FINANCE_KEYS.includes(f.key)
                const v = fv[f.key]
                return (
                  <div key={f.key}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-stone-700">
                        {f.label}
                        {fromAudit[f.key] != null && Number(vals[f.key]) === fromAudit[f.key] && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            from night audit
                          </span>
                        )}
                      </span>
                      <div className="w-36">
                        {f.auto ? (
                          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-right text-lg font-semibold">
                            {autoVals[f.key].toLocaleString('en-IN')}
                          </div>
                        ) : (
                          <input className={input} inputMode={f.decimal || f.money ? 'decimal' : 'numeric'}
                            aria-label={f.label} disabled={!editable} placeholder="0"
                            value={vals[f.key]} onChange={setVal(f.key, f.decimal || f.money)} />
                        )}
                      </div>
                    </div>
                    {verifiable && status !== 'missing' && (
                      <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                        {!v && status === 'verified' ? (
                          <span className="text-green-700">✓ Verified</span>
                        ) : v ? (
                          <>
                            <span className="text-green-700">✓ Verified by {v.by}</span>
                            {canVerifyFields && status === 'submitted' && (
                              <button disabled={busy} onClick={() => verifyField(f.key, false)}
                                className="rounded-md bg-stone-100 px-2 py-1 text-stone-700">Undo</button>
                            )}
                          </>
                        ) : canVerifyFields ? (
                          <button disabled={busy} onClick={() => verifyField(f.key, true)}
                            className="rounded-md bg-green-600 px-3 py-1 font-medium text-white disabled:opacity-60">Verify</button>
                        ) : (
                          <span className="text-amber-700">Not verified</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

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
        <div className="space-y-2">
          {!allFinanceVerified && (
            <button disabled={busy} onClick={verifyAllFinance}
              className="w-full rounded-xl bg-green-100 py-2.5 text-sm font-medium text-green-800 disabled:opacity-60">
              Verify all finance fields
            </button>
          )}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => review('draft')}
              className="flex-1 rounded-xl bg-stone-200 py-3 font-medium disabled:opacity-60">Send back</button>
            <button disabled={busy || !allFinanceVerified} onClick={() => review('verified')}
              className="flex-1 rounded-xl bg-green-700 py-3 font-medium text-white disabled:opacity-40">Verify summary</button>
          </div>
          {!allFinanceVerified && (
            <p className="text-center text-xs text-stone-500">
              Verify all {FINANCE_KEYS.length} finance fields first ({verifiedCount}/{FINANCE_KEYS.length} done).
            </p>
          )}
        </div>
      )}
      {isManagement && status === 'verified' && (
        <button disabled={busy} onClick={() => review('draft')}
          className="w-full rounded-xl bg-stone-200 py-3 font-medium disabled:opacity-60">Reopen as draft</button>
      )}
    </div>
  )
}
