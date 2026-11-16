import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/AuthContext'
import { latestByRoom, useChecks, useMaintenance } from '../lib/useMaintenance'
import { SECTIONS } from '../lib/maintenance'
import { prettyDate, todayIST } from '../lib/dates'

const SECTION_ORDER = Object.keys(SECTIONS)

// Copies the room type's active checklist so later edits to the checklist never change this check.
function buildRows(typeId, allItems) {
  return allItems
    .filter((i) => i.typeId === typeId && i.active !== false)
    .sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || (a.order || 0) - (b.order || 0))
    .map((i) => ({ id: i.id, section: i.section, label: i.label, ok: null, remark: '' }))
}

export default function MaintenanceCheck() {
  const { roomId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { loading, types, rooms, items: allItems } = useMaintenance()
  const { checks } = useChecks()

  const [rows, setRows] = useState(null)
  const [resumed, setResumed] = useState(false)
  const [saveState, setSaveState] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showProblems, setShowProblems] = useState(false)

  const room = rooms.find((r) => r.id === roomId)
  const type = types.find((t) => t.id === room?.typeId)

  // Latest values for the debounced / unmount save.
  const latest = useRef({})
  const dirty = useRef(false)
  const timer = useRef(null)
  const started = useRef(false)
  const inflight = useRef(null)

  latest.current = { rows, room, user }

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    const { rows: r, room: rm, user: u } = latest.current
    if (!r || !rm) return
    // An untouched checklist is not worth a draft.
    if (!r.some((x) => x.ok !== null || x.remark)) return
    try {
      inflight.current = setDoc(doc(db, 'maintenanceDrafts', rm.id), {
        roomId: rm.id, roomNumber: rm.number, typeId: rm.typeId, items: r, updatedAt: Date.now(), updatedBy: u.name,
      })
      await inflight.current
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [])

  // Build the working list once: resume the draft if there is one, otherwise start from the type's checklist.
  useEffect(() => {
    if (loading || !room || started.current) return
    started.current = true
    ;(async () => {
      let draft = null
      try {
        const snap = await getDoc(doc(db, 'maintenanceDrafts', roomId))
        if (snap.exists()) draft = snap.data()
      } catch {
        // offline with no cached draft: start fresh
      }
      if (draft?.items?.length) {
        setRows(draft.items)
        setResumed(true)
      } else {
        setRows(buildRows(room.typeId, allItems))
      }
    })()
  }, [loading, room, roomId, allItems])

  // Save anything still pending when leaving the page.
  useEffect(
    () => () => {
      flush()
    },
    [flush]
  )

  function update(next) {
    setRows(next)
    latest.current.rows = next
    dirty.current = true
    setSaveState('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
  }

  const setOk = (i, value) =>
    update(
      rows.map((r, idx) => {
        if (idx !== i) return r
        const ok = r.ok === value ? null : value
        return { ...r, ok, remark: ok === false ? r.remark : '' }
      })
    )
  const setRemark = (i, remark) => update(rows.map((r, idx) => (idx === i ? { ...r, remark } : r)))
  const markRest = () => update(rows.map((r) => (r.ok === null ? { ...r, ok: true } : r)))

  if (loading || (room && !rows && !error)) return <p className="text-stone-500">Loading…</p>
  if (!room || room.active === false) {
    return (
      <div className="space-y-3">
        <p className="text-stone-600">That room was not found or is inactive.</p>
        <Link to="/maintenance" className="text-amber-800">← Maintenance</Link>
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <Link to="/maintenance" className="text-sm text-amber-800">← Maintenance</Link>
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">
          The {type?.name} checklist has no active items. Ask Management to add items in Maintenance → Setup.
        </p>
      </div>
    )
  }

  const answered = rows.filter((r) => r.ok !== null).length
  const unanswered = rows.length - answered
  const missingRemarks = rows.filter((r) => r.ok === false && !r.remark.trim()).length
  const fails = rows.filter((r) => r.ok === false).length
  const ready = unanswered === 0 && missingRemarks === 0
  const last = latestByRoom(checks)[room.id]

  async function submit() {
    if (!ready) return setShowProblems(true)
    setBusy(true)
    setError('')
    try {
      clearTimeout(timer.current)
      dirty.current = false
      // Let any autosave that is already on its way finish first, so it cannot re-create the draft after we delete it.
      await Promise.resolve(inflight.current).catch(() => {})
      const today = todayIST()
      const items = rows.map((r) => ({ ...r, remark: r.ok === false ? r.remark.trim() : '' }))
      const batch = writeBatch(db)
      batch.set(doc(collection(db, 'maintenanceChecks')), {
        roomId: room.id, roomNumber: room.number, typeId: room.typeId, typeName: type?.name || '',
        date: today, month: today.slice(0, 7),
        filledBy: user.name, filledById: user.id,
        items, itemCount: items.length, failCount: fails,
        submittedAt: Date.now(),
      })
      batch.delete(doc(db, 'maintenanceDrafts', room.id))
      await batch.commit()
      navigate('/maintenance', { state: { done: { room: room.number, fails } } })
    } catch (err) {
      dirty.current = true
      setError(err.message || 'Could not submit. Your answers are still saved as a draft.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/maintenance" className="text-sm text-amber-800">← Maintenance</Link>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Room {room.number}</h2>
          <span className="text-sm text-stone-500">{type?.name}</span>
        </div>
        <p className="text-xs text-stone-500">
          {last ? `Last checked ${prettyDate(last.date)}${last.failCount ? ` · ${last.failCount} issue(s)` : ' · all OK'}` : 'Not checked before'}
          {resumed && ' · continuing your saved draft'}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-3">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">{answered} of {rows.length} done{fails > 0 && <span className="text-red-600"> · {fails} issue(s)</span>}</span>
          <span className="text-xs text-stone-400">
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : saveState === 'error' ? 'Not saved' : ''}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full bg-amber-700 transition-all" style={{ width: `${(answered / rows.length) * 100}%` }} />
        </div>
        {unanswered > 0 && (
          <button onClick={markRest} className="mt-3 w-full rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-800 active:bg-green-100">
            ✓ Mark all {unanswered} remaining as OK
          </button>
        )}
      </div>

      {SECTION_ORDER.map((section) => {
        const sectionRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.section === section)
        if (sectionRows.length === 0) return null
        return (
          <section key={section} className="space-y-2">
            <h3 className="font-semibold text-amber-900">{SECTIONS[section]}</h3>
            <ul className="space-y-2">
              {sectionRows.map(({ r, i }) => {
                const needsRemark = r.ok === false && !r.remark.trim()
                return (
                  <li key={r.id} data-item={r.label}
                    className={`rounded-2xl border bg-white p-3 ${r.ok === false ? 'border-red-300' : 'border-stone-200'} ${showProblems && r.ok === null ? 'border-amber-500' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-base font-medium">{r.label}</span>
                      <button type="button" aria-label={`${r.label} OK`} aria-pressed={r.ok === true} onClick={() => setOk(i, true)}
                        className={`h-12 w-14 rounded-xl text-2xl font-bold ${r.ok === true ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-400'}`}>✓</button>
                      <button type="button" aria-label={`${r.label} problem`} aria-pressed={r.ok === false} onClick={() => setOk(i, false)}
                        className={`h-12 w-14 rounded-xl text-2xl font-bold ${r.ok === false ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-400'}`}>✗</button>
                    </div>
                    {r.ok === false && (
                      <textarea rows={2} value={r.remark} onChange={(e) => setRemark(i, e.target.value)}
                        placeholder="What is wrong? (required)" autoFocus={!r.remark}
                        className={`mt-2 w-full rounded-xl border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-red-200 ${needsRemark && showProblems ? 'border-red-500 bg-red-50' : 'border-stone-300'}`} />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {showProblems && !ready && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {unanswered > 0 && <>{unanswered} item(s) are not answered. </>}
          {missingRemarks > 0 && <>{missingRemarks} problem(s) need a remark.</>}
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button onClick={submit} disabled={busy}
        className={`w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-60 ${ready ? 'bg-amber-800 active:bg-amber-900' : 'bg-stone-400'}`}>
        {busy ? 'Submitting…' : ready ? `Submit checklist${fails ? ` (${fails} issue${fails > 1 ? 's' : ''})` : ''}` : 'Submit checklist'}
      </button>
    </div>
  )
}
