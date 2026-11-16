import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../auth/AuthContext'
import { can } from '../lib/roles'
import { prettyDate, todayIST } from '../lib/dates'
import Sheet from '../components/Sheet'
import { downloadCsv } from '../lib/maintenanceReports'
import {
  GENERATORS, buildPeriods, estimateNow, highPeriods, levels, periodsCsvRows, round, sortEntries, totals, validateEntry,
} from '../lib/generator'

const L = (n, d = 1) => `${Number(round(n, d)).toLocaleString('en-IN')} L`
const TYPE = { opening: 'Opening', reading: 'Stock reading', topup: 'Top-up' }

export default function Generator() {
  const { user } = useAuth()
  const isMgmt = can(user, 'generatorSetup')
  const today = todayIST()
  const [entries, setEntries] = useState(null)
  const [summaries, setSummaries] = useState({})
  const [genKey, setGenKey] = useState('gen45Hrs')
  const gen = GENERATORS.find((g) => g.key === genKey)
  const [form, setForm] = useState(null) // { type, id? }
  const [msg, setMsg] = useState('')

  useEffect(() => onSnapshot(collection(db, 'generatorFuel'), (snap) =>
    setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))), [])

  const all = useMemo(() => sortEntries(entries || []), [entries])
  const sorted = useMemo(() => all.filter((e) => e.gen === genKey), [all, genKey])
  const first = all[0]?.date
  useEffect(() => {
    if (!first) return
    return onSnapshot(query(collection(db, 'dailySummaries'), where('date', '>=', first)), (snap) =>
      setSummaries(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))))
  }, [first])

  const opening = sorted.find((e) => e.type === 'opening')
  const capacity = opening?.capacity ? Number(opening.capacity) : null
  const periods = useMemo(() => buildPeriods(sorted, summaries, genKey), [sorted, summaries])
  const T = useMemo(() => totals(periods), [periods])
  const high = useMemo(() => highPeriods(periods, T.avgLph), [periods, T.avgLph])
  const now = useMemo(() => estimateNow(sorted, summaries, T.avgLph, today, genKey), [sorted, summaries, T.avgLph, today, genKey])

  if (entries === null) return <p className="text-stone-500">Loading…</p>

  async function remove(e) {
    if (e.type === 'opening' && sorted.length > 1) { setMsg('Delete the later entries first. The opening volume cannot be removed while they exist.'); return }
    if (!confirm(`Delete this ${TYPE[e.type].toLowerCase()} (${prettyDate(e.date)})?`)) return
    await deleteDoc(doc(db, 'generatorFuel', e.id))
    setMsg('Entry deleted.')
  }

  const lastLevel = sorted.length ? levels(sorted[sorted.length - 1]).after : null
  const periodOf = (id) => periods.find((p) => p.entry.id === id)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Generator fuel</h2>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="tablist">
        {GENERATORS.map((g) => (
          <button key={g.key} role="tab" aria-selected={g.key === genKey} onClick={() => { setGenKey(g.key); setMsg('') }}
            className={`rounded-lg py-2 text-sm font-medium ${g.key === genKey ? 'bg-white shadow-sm text-amber-900' : 'text-stone-600'}`}>
            {g.label} generator
          </button>
        ))}
      </div>
      {msg && <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm" onClick={() => setMsg('')}>{msg}</p>}

      {!opening ? (
        <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            {isMgmt ? `Set the opening fuel volume of the ${gen.label} generator's tank to start tracking.` : `Management needs to set the opening tank volume of the ${gen.label} generator before top-ups can be recorded.`}
          </p>
          {isMgmt && <button onClick={() => setForm({ type: 'opening' })} className="w-full rounded-xl bg-amber-800 py-3 font-medium text-white">Set opening volume</button>}
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-stone-500">Last recorded level · {prettyDate(now.lastDate)}</p>
            <p className="text-2xl font-semibold" data-testid="last-level">{L(now.lastLevel)}</p>
            {now.estimate != null && (
              <p className="text-sm text-stone-600" data-testid="stock-estimate">
                Estimated now: about <b>{L(now.estimate, 0)}</b> <span className="text-stone-400">({now.hours} h run since)</span>
              </p>
            )}
            {capacity && <p className="text-xs text-stone-400">Tank capacity {L(capacity, 0)}</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setForm({ type: 'topup' })} className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white">+ Fuel top-up</button>
            {isMgmt && <button onClick={() => setForm({ type: 'reading' })} className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Add stock reading</button>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm" data-testid="stats">
            <Stat label="Fuel consumed" value={L(T.consumed)} />
            <Stat label="Hours run" value={`${T.hours} h`} />
            <Stat label="Average mileage" value={T.avgLph != null ? `${round(T.avgLph, 2)} L/hr` : '–'} />
            <Stat label="Fuel added" value={L(T.added)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">Consumption by period</p>
              <button onClick={() => downloadCsv(`mansarover-generator-${gen.label.replace(' ', '')}-fuel.csv`, periodsCsvRows(periods, gen.label))} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm">Export CSV</button>
            </div>
            {periods.length === 0 && <p className="text-sm text-stone-500">Periods appear after the first top-up.</p>}
            {[...periods].reverse().map((p) => (
              <div key={p.entry.id} data-testid="period" className="rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{prettyDate(p.from)} → {prettyDate(p.to)}</p>
                  <p className="text-sm font-semibold tabular-nums">{p.lph != null ? `${round(p.lph, 2)} L/hr` : '–'}</p>
                </div>
                <p className="text-sm text-stone-600">
                  Used <b>{L(p.consumed)}</b> in <b>{p.hours} h</b> run
                </p>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {high.has(p.entry.id) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">High consumption</span>}
                  {p.rose && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">Level rose – check readings</span>}
                  {p.days === 0 && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">Same day</span>}
                  {p.notSubmitted > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{p.notSubmitted} day(s) hours not submitted</span>}
                  {p.legacy > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{p.legacy} day(s) with old combined hours</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sorted.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium">Entries</p>
          {[...sorted].reverse().map((e) => {
            const { before, after } = levels(e)
            return (
              <div key={e.id} data-testid="entry" className="flex items-start justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{TYPE[e.type]} · {prettyDate(e.date)}</p>
                  <p className="text-stone-600">
                    {e.type === 'topup' ? `${L(before)} → ${L(after)} (added ${L(after - before)})` : L(after)}
                  </p>
                  {e.note && <p className="truncate text-xs text-stone-500">{e.note}</p>}
                </div>
                {isMgmt && (
                  <div className="flex shrink-0 gap-1 text-sm">
                    <button onClick={() => setForm({ type: e.type, id: e.id })} className="rounded-lg bg-stone-100 px-2 py-1">Edit</button>
                    <button onClick={() => remove(e)} className="rounded-lg bg-red-50 px-2 py-1 text-red-700">Delete</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <EntryForm key={`${genKey}-${form.id || form.type}`} gen={gen} form={form} entries={sorted} capacity={capacity} today={today} lastLevel={lastLevel} user={user}
          onClose={(m) => { setForm(null); if (m) setMsg(m) }} />
      )}
    </div>
  )
}

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-stone-50 p-3"><p className="text-xs text-stone-500">{label}</p><p className="font-semibold">{value}</p></div>
)

function EntryForm({ gen, form, entries, capacity, today, lastLevel, user, onClose }) {
  const editing = form.id ? entries.find((e) => e.id === form.id) : null
  const [d, setD] = useState(() => ({
    type: form.type,
    date: editing?.date || today,
    level: editing?.level ?? '',
    before: editing?.before ?? '',
    after: editing?.after ?? '',
    capacity: editing?.capacity ?? '',
    note: editing?.note || '',
  }))
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const set = (k) => (e) => { setConfirmed(false); setD((x) => ({ ...x, [k]: e.target.value })) }
  const cap = d.type === 'opening' ? Number(d.capacity) || null : capacity
  const { errors, warnings } = validateEntry(d, entries, { editingId: form.id || null, today, capacity: cap })
  const added = d.type === 'topup' && Number(d.after) > Number(d.before) ? Number(d.after) - Number(d.before) : null
  const title = `${gen.label} · ${{ opening: 'Opening tank volume', reading: 'Stock reading', topup: 'Fuel top-up' }[d.type]}`
  const blocked = errors.length > 0 || (warnings.length > 0 && !confirmed)

  async function save() {
    setBusy(true)
    const data = { type: d.type, gen: gen.key, date: d.date, note: d.note.trim() }
    if (d.type === 'topup') { data.before = Number(d.before); data.after = Number(d.after) }
    else data.level = Number(d.level)
    if (d.type === 'opening') data.capacity = d.capacity ? Number(d.capacity) : null
    try {
      if (editing) await updateDoc(doc(db, 'generatorFuel', editing.id), { ...data, updatedBy: user.id, updatedAt: Date.now() })
      else await addDoc(collection(db, 'generatorFuel'), { ...data, createdBy: user.id, createdByName: user.name, createdAt: Date.now() })
      onClose('Saved.')
    } catch (err) { setBusy(false); alert(err.message || 'Could not save.') }
  }

  return (
    <Sheet title={title} onClose={() => onClose()}>
      <Field d={d} set={set} label="Date (fuel measured at the start of this day)" k="date" type="date" max={today} />
      {d.type === 'topup' ? (
        <>
          <Field d={d} set={set} label="Volume before top-up (litres)" k="before" inputMode="decimal" placeholder="e.g. 440" />
          <Field d={d} set={set} label="Volume after top-up (litres)" k="after" inputMode="decimal" placeholder="e.g. 600" />
          {added != null && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">Fuel added: <b>{L(added)}</b></p>}
        </>
      ) : (
        <Field d={d} set={set} label="Fuel in tank (litres)" k="level" inputMode="decimal" />
      )}
      {d.type === 'opening' && <Field d={d} set={set} label="Tank capacity in litres (optional)" k="capacity" inputMode="decimal" />}
      <Field d={d} set={set} label="Note (optional)" k="note" />
      {lastLevel != null && d.type === 'topup' && <p className="text-xs text-stone-500">Last recorded level: {L(lastLevel)}</p>}
      {errors.map((e) => <p key={e} className="text-sm text-red-700">⚠ {e}</p>)}
      {warnings.map((w) => <p key={w} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠ {w}</p>)}
      {warnings.length > 0 && errors.length === 0 && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> The reading is correct, save anyway</label>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onClose()} className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Cancel</button>
        <button disabled={busy || blocked} onClick={save} className="flex-1 rounded-xl bg-amber-800 py-3 font-medium text-white disabled:opacity-50">Save</button>
      </div>
    </Sheet>
  )
}

function Field({ d, set, label, k, ...p }) {
  return (
    <label className="block text-sm"><span className="text-stone-600">{label}</span>
      <input value={d[k]} onChange={set(k)} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3 text-base" {...p} /></label>
  )
}
