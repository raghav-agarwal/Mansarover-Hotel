import { useRef, useState } from 'react'
import { prettyDate } from '../lib/dates'
import { buildFields, parseNightAudit } from '../lib/auditParser'

const LABELS = {
  occupied: 'Rooms occupied',
  checkOut: 'Check-outs',
  cashReceipt: 'Cash receipt',
  upiReceipts: 'UPI receipts',
  cardReceipts: 'Card receipts',
  bankTransfers: 'Bank transfers',
  billToCompany: 'Bill to Company',
}
const MONEY = ['cashReceipt', 'upiReceipts', 'cardReceipts', 'bankTransfers', 'billToCompany']
const TARGETS = [
  ['cashReceipt', 'Cash receipt'],
  ['upiReceipts', 'UPI receipts'],
  ['cardReceipts', 'Card receipts'],
  ['bankTransfers', 'Bank transfers'],
  ['billToCompany', 'Bill to Company'],
]

const fmt = (k, v) => (MONEY.includes(k) ? '₹ ' : '') + Number(v).toLocaleString('en-IN')

export default function NightAuditUpload({ date, onApply, disabled }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState([])
  const [fileName, setFileName] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Please choose the .xlsx night audit file. (Older .xls files need to be saved as .xlsx first.)')
      return
    }
    setBusy(true)
    try {
      // Loaded only when needed, so the rest of the app stays small and fast.
      const { readSheet } = await import('read-excel-file/universal')
      const rows = await readSheet(file)
      const p = parseNightAudit(rows)
      if (p.occupied == null && !p.receiptsFound && !p.checkOutFound) {
        throw new Error("This doesn't look like a night audit report. Nothing could be found in it.")
      }
      setParsed(p)
      setMapping(p.receipts.map((r) => r.field))
      setFileName(file.name)
    } catch (err) {
      setError(err.message || 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const close = () => setParsed(null)
  const fields = parsed ? buildFields(parsed, mapping) : {}
  const dateMismatch = parsed?.reportDate && parsed.reportDate !== date
  const unmappedIgnored = parsed ? parsed.receipts.filter((_, i) => !mapping[i]) : []

  function apply() {
    onApply(fields, fileName)
    close()
  }

  return (
    <div>
      <input ref={fileRef} type="file" hidden accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={onFile} />
      <button type="button" disabled={disabled || busy} onClick={() => fileRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 py-3 font-medium text-amber-900 active:bg-amber-100 disabled:opacity-60">
        {busy ? 'Reading file…' : '⬆ Upload night audit (.xlsx) to auto-fill'}
      </button>
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {parsed && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div>
              <h3 className="text-lg font-semibold">Check before filling</h3>
              <p className="truncate text-xs text-stone-500">{fileName}</p>
            </div>

            {dateMismatch ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                ⚠ This report is for <b>{prettyDate(parsed.reportDate)}</b>, but you are filling{' '}
                <b>{prettyDate(date)}</b>. Check you picked the right file.
              </p>
            ) : (
              parsed.reportDate && (
                <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
                  ✓ Report date matches ({prettyDate(parsed.reportDate)}).
                </p>
              )
            )}

            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {Object.entries(LABELS).map(([k, label]) => (
                <li key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-stone-600">{label}</span>
                  {fields[k] != null ? (
                    <span className="font-semibold tabular-nums">{fmt(k, fields[k])}</span>
                  ) : (
                    <span className="text-stone-400">not found – left as is</span>
                  )}
                </li>
              ))}
            </ul>

            {parsed.receipts.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Payment types in the report</p>
                {parsed.receipts.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {r.type} <span className="text-stone-400">₹ {r.amount.toLocaleString('en-IN')}</span>
                    </span>
                    <select value={mapping[i]} onChange={(e) => setMapping((m) => m.map((x, j) => (j === i ? e.target.value : x)))}
                      className={`rounded-lg border px-2 py-1.5 ${mapping[i] ? 'border-stone-300' : 'border-amber-500 bg-amber-50'}`}>
                      <option value="">Ignore</option>
                      {TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {unmappedIgnored.length > 0 && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                ⚠ Not counted: {unmappedIgnored.map((r) => `${r.type} (₹ ${r.amount.toLocaleString('en-IN')})`).join(', ')}.
                Pick where each belongs, or the receipts won't add up to the report total.
              </p>
            )}

            <ul className="space-y-1 text-sm">
              {parsed.checks.map((c, i) => (
                <li key={i} className={c.ok ? 'text-green-700' : 'text-red-700'}>{c.ok ? '✓' : '⚠'} {c.text}</li>
              ))}
              {parsed.warnings.map((w, i) => <li key={`w${i}`} className="text-amber-700">⚠ {w}</li>)}
            </ul>

            <p className="text-xs text-stone-500">
              Applying fills these fields and saves a draft. You can still edit any value. In-house guests, Buffet,
              Food sale, Reviews, Cash expenses and Generator hours are not in the report.
            </p>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={close} className="flex-1 rounded-xl bg-stone-100 py-3 font-medium">Cancel</button>
              <button type="button" onClick={apply}
                className={`flex-1 rounded-xl py-3 font-medium text-white ${dateMismatch ? 'bg-red-700' : 'bg-amber-800'}`}>
                {dateMismatch ? 'Apply anyway' : 'Apply & save draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
