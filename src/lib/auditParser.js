// Parses the PMS "Night Audit Report" (already read into rows of cells by read-excel-file).
// Sections are located by their headings, never by fixed cell positions, because the number of
// rows in each section changes every day.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

const text = (c) => (c == null ? '' : String(c).trim())
const lower = (c) => text(c).toLowerCase()
const isBlankRow = (r) => !r || r.every((c) => text(c) === '')

// "19,912.81" / 11 / " 4,150.02 " -> number (or null)
export function toNumber(c) {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  const t = text(c).replace(/,/g, '').replace(/[^\d.\-]/g, '')
  if (!t || t === '-' || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// "14 Nov 2026" -> "2026-11-14"
export function toIsoDate(c) {
  if (c instanceof Date) {
    const p = (n) => String(n).padStart(2, '0')
    return `${c.getFullYear()}-${p(c.getMonth() + 1)}-${p(c.getDate())}`
  }
  const m = text(c).match(/^(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s-](\d{4})$/)
  if (!m || !MONTHS[m[2].toLowerCase()]) return null
  return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// A heading row has exactly one non-empty cell, e.g. "Checked Out" or "Total Receipts".
function findHeading(rows, name, from = 0) {
  for (let i = from; i < rows.length; i++) {
    const filled = (rows[i] || []).filter((c) => text(c) !== '')
    if (filled.length === 1 && lower(filled[0]) === name) return i
  }
  return -1
}

function colIndex(headerRow, label) {
  return (headerRow || []).findIndex((c) => lower(c) === label)
}

export const FIELD_FOR_TYPE = {
  cash: 'cashReceipt',
  upi: 'upiReceipts',
  card: 'cardReceipts',
  'bank transfer': 'bankTransfers',
  'bill to company': 'billToCompany',
}

// "Bank Transfers", "bank  transfer" and "BANK TRANSFER" all map to the same field.
export function fieldForType(label) {
  const k = text(label).toLowerCase().replace(/\s+/g, ' ').replace(/s$/, '')
  return FIELD_FOR_TYPE[k] || ''
}

const round2 = (n) => Math.round(n * 100) / 100

export function parseNightAudit(rows) {
  const out = {
    reportDate: null,
    occupied: null,
    checkOut: 0,
    checkOutFound: false,
    receipts: [], // [{ type, amount, field }]
    receiptsFound: false,
    reportedTotal: null,
    checks: [], // [{ ok, text }]
    warnings: [],
  }

  // Report date: first date-like cell near the top ("14 Nov 2026"), skipping the month-to-date range.
  for (let i = 0; i < Math.min(rows.length, 12) && !out.reportDate; i++) {
    for (const c of rows[i] || []) {
      const d = toIsoDate(c)
      if (d) {
        out.reportDate = d
        break
      }
    }
  }
  if (!out.reportDate) out.warnings.push('Could not find the report date.')

  // Rooms occupied: first number to the right of the "No. of rooms occupied" label (today's column).
  const occ = rows.find((r) => lower(r?.[0]).includes('rooms occupied'))
  if (occ) {
    const n = occ.slice(1).map(toNumber).find((v) => v != null)
    if (n != null) out.occupied = n
  }
  if (out.occupied == null) out.warnings.push('"No. of rooms occupied" not found.')

  // Check-outs: number of guest rows under the "Checked Out" heading.
  const co = findHeading(rows, 'checked out')
  if (co >= 0) {
    out.checkOutFound = true
    let i = co + 1
    while (i < rows.length && lower(rows[i]?.[0]) !== 'guest name' && !isBlankRow(rows[i])) i++
    if (lower(rows[i]?.[0]) === 'guest name') {
      for (i += 1; i < rows.length && !isBlankRow(rows[i]); i++) {
        if (text(rows[i][0]) !== '') out.checkOut += 1
      }
    }
  } else {
    out.warnings.push('"Checked Out" table not found, so check-outs are set to 0.')
  }

  // Total Receipts table: Payment Type / Value rows until "Total".
  const tr = findHeading(rows, 'total receipts')
  if (tr >= 0) {
    let i = tr + 1
    while (i < rows.length && lower(rows[i]?.[0]) !== 'payment type') i++
    if (i < rows.length) {
      out.receiptsFound = true
      for (i += 1; i < rows.length && !isBlankRow(rows[i]); i++) {
        const label = text(rows[i][0])
        if (label.endsWith(':')) continue // "Receipts Summary :" sub-heading
        const amount = toNumber(rows[i][1])
        if (lower(label) === 'total') {
          out.reportedTotal = amount
          break
        }
        if (label && amount != null) {
          out.receipts.push({ type: label, amount, field: fieldForType(label) })
        }
      }
    }
  }
  if (!out.receiptsFound) out.warnings.push('"Total Receipts" table not found.')

  // Cross-check 1: payment types add up to the report's own total.
  if (out.receiptsFound && out.reportedTotal != null) {
    const sum = round2(out.receipts.reduce((a, r) => a + r.amount, 0))
    const ok = Math.abs(sum - out.reportedTotal) < 0.05
    out.checks.push({
      ok,
      text: ok
        ? `Payment types add up to the report total (${out.reportedTotal.toLocaleString('en-IN')}).`
        : `Payment types add up to ${sum.toLocaleString('en-IN')} but the report total is ${out.reportedTotal.toLocaleString('en-IN')}.`,
    })
  }

  // Cross-check 2: the individual payment lines agree with the summary table, type by type.
  const hdr = rows.findIndex((r) => lower(r?.[0]) === 'room no.' && colIndex(r, 'mode of payment') >= 0)
  if (hdr >= 0 && out.receipts.length) {
    const modeCol = colIndex(rows[hdr], 'mode of payment')
    const amtCol = colIndex(rows[hdr], 'payment amount (inr)')
    const sums = {}
    for (let i = hdr + 1; i < rows.length; i++) {
      const r = rows[i]
      if (lower(r?.[0]) === 'total') break
      const mode = text(r?.[modeCol])
      const amt = toNumber(r?.[amtCol])
      if (mode && amt != null) sums[mode] = round2((sums[mode] || 0) + amt)
    }
    const bad = out.receipts.filter((r) => Math.abs((sums[r.type] || 0) - r.amount) >= 0.05)
    out.checks.push({
      ok: bad.length === 0,
      text:
        bad.length === 0
          ? 'Individual payment lines match the summary for every payment type.'
          : `Payment lines differ from the summary for: ${bad.map((b) => b.type).join(', ')}.`,
    })
  }

  return out
}

// Turns the parsed report + the user's payment-type mapping into summary field values.
export function buildFields(parsed, mapping) {
  const fields = {}
  if (parsed.occupied != null) fields.occupied = parsed.occupied
  fields.checkOut = parsed.checkOut
  if (parsed.receiptsFound) {
    Object.assign(fields, { cashReceipt: 0, upiReceipts: 0, cardReceipts: 0, bankTransfers: 0, billToCompany: 0 })
    parsed.receipts.forEach((r, i) => {
      const f = mapping[i]
      if (f) fields[f] = round2(fields[f] + r.amount)
    })
  }
  return fields
}
