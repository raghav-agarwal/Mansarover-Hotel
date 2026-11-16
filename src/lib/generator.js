// Fuel tracking for the two generators (45 KW and 82 KW). Each generator has its OWN tank, so every
// entry belongs to one generator (entry.gen = 'gen45Hrs' | 'gen82Hrs') and is tracked separately.
//
// Entries (collection "generatorFuel"), all measured at the START of their date, before the generators run that day:
//   { type: 'opening', date, level, capacity? }          Management, first entry only
//   { type: 'reading', date, level }                      Management, a measured level (recalibration)
//   { type: 'topup',   date, before, after, note? }       Accountant (or Management)
//
// Fuel used between two entries = (level after the earlier entry) - (level before the later entry).
// Running hours for that period come from the daily summaries of the days from the earlier entry's date up to,
// but not including, the later entry's date.
import { addDays } from './dates'

export const GENERATORS = [
  { key: 'gen45Hrs', label: '45 KW' },
  { key: 'gen82Hrs', label: '82 KW' },
]

const num = (v) => Number(v) || 0
export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export const levels = (e) => (e.type === 'topup' ? { before: num(e.before), after: num(e.after) } : { before: num(e.level), after: num(e.level) })

export const sortEntries = (list) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0))

// A day's hours are only trusted once the summary has been submitted (or verified).
const reliableDay = (s) => !!s && (s.status === 'submitted' || s.status === 'verified')
// Days saved before the hours were split into two fields only have a combined number we cannot use.
const legacyDay = (s) => !!s && s.gen45Hrs == null && s.gen82Hrs == null && s.generatorHrs != null

export function buildPeriods(entries, summaries, key) {
  const out = []
  let prev = null
  for (const e of sortEntries(entries)) {
    const { before, after } = levels(e)
    if (prev) {
      let hours = 0
      let days = 0
      let notSubmitted = 0
      let legacy = 0
      for (let d = prev.date; d < e.date; d = addDays(d, 1)) {
        days += 1
        const s = summaries[d]
        if (!reliableDay(s)) notSubmitted += 1
        if (legacyDay(s)) legacy += 1
        if (s) hours += num(s[key])
      }
      const consumed = round(prev.level - before)
      hours = round(hours)
      out.push({
        entry: e, from: prev.date, to: e.date, days,
        consumed, rose: consumed < 0,
        hours,
        lph: hours > 0 && consumed > 0 ? consumed / hours : null,
        added: round(after - before),
        notSubmitted, legacy,
        trusted: days > 0 && notSubmitted === 0 && consumed >= 0,
      })
    }
    prev = { date: e.date, level: after }
  }
  return out
}

// Overall figures over periods that make sense (at least one day, level did not rise).
export function totals(periods) {
  const ok = periods.filter((p) => p.days > 0 && !p.rose)
  const consumed = round(ok.reduce((n, p) => n + p.consumed, 0))
  const hours = round(ok.reduce((n, p) => n + p.hours, 0))
  return {
    consumed, hours,
    avgLph: hours > 0 ? consumed / hours : null,
    added: round(periods.reduce((n, p) => n + p.added, 0)),
    topups: periods.filter((p) => p.entry.type === 'topup').length,
  }
}

// A period is "high" when its litres/hour is 25% above the overall average (needs 3+ periods to mean anything).
export function highPeriods(periods, avgLph) {
  const withLph = periods.filter((p) => p.lph != null)
  if (avgLph == null || withLph.length < 3) return new Set()
  return new Set(withLph.filter((p) => p.lph > avgLph * 1.25).map((p) => p.entry.id))
}

// Rough litres in the tank today: last recorded level minus average burn for the days since.
export function estimateNow(entries, summaries, avgLph, today, key) {
  const sorted = sortEntries(entries)
  const last = sorted[sorted.length - 1]
  if (!last) return null
  const { after } = levels(last)
  let hours = 0
  for (let d = last.date; d < today; d = addDays(d, 1)) {
    const s = summaries[d]
    if (s) hours += num(s[key])
  }
  return { lastDate: last.date, lastLevel: after, hours: round(hours), estimate: avgLph != null ? Math.max(0, round(after - hours * avgLph, 1)) : null }
}

// Checks a new or edited entry. Returns { errors: [...], warnings: [...] }.
export function validateEntry(draft, entries, { editingId = null, today, capacity = null } = {}) {
  const errors = []
  const warnings = []
  const sorted = sortEntries(entries)
  const others = sorted.filter((e) => e.id !== editingId)
  const hasOpening = others.some((e) => e.type === 'opening')
  const amount = (v) => (v === '' || v == null ? NaN : Number(v))

  if (!draft.date) errors.push('Date is required.')
  else if (draft.date > today) errors.push('Date cannot be in the future.')

  if (draft.type === 'opening') {
    if (hasOpening) errors.push('An opening volume already exists. Use "Add stock reading" to correct the level.')
    if (others.some((e) => e.date < draft.date)) errors.push('The opening volume must come before all other entries.')
  } else if (!hasOpening) {
    errors.push('Management must set the opening tank volume first.')
  }

  if (draft.type === 'topup') {
    const before = amount(draft.before)
    const after = amount(draft.after)
    if (!(before >= 0)) errors.push('Enter the volume before top-up.')
    if (!(after >= 0)) errors.push('Enter the volume after top-up.')
    if (before >= 0 && after >= 0 && after <= before) errors.push('Volume after top-up must be higher than before.')
    if (capacity && after > capacity) errors.push(`Volume after top-up is more than the tank capacity (${capacity} L).`)
  } else {
    const level = amount(draft.level)
    if (!(level >= 0)) errors.push('Enter the fuel volume in litres.')
    if (capacity && level > capacity) errors.push(`Volume is more than the tank capacity (${capacity} L).`)
    if (draft.type === 'opening' && draft.capacity !== '' && draft.capacity != null && !(Number(draft.capacity) > 0)) errors.push('Tank capacity must be a positive number.')
    if (draft.type === 'opening' && draft.capacity && level > Number(draft.capacity)) errors.push('Opening volume is more than the tank capacity.')
  }

  // Keep entries in date order: not before the previous entry, not after the next one (when editing).
  if (draft.date && draft.type !== 'opening') {
    const prevOne = [...others].reverse().find((e) => e.date <= draft.date && (editingId == null || e.date <= draft.date))
    const lastDate = others.length ? others[others.length - 1].date : null
    if (editingId == null && lastDate && draft.date < lastDate) errors.push(`A newer entry exists (${lastDate}). Add entries in date order.`)
    if (editingId != null) {
      const me = sorted.find((e) => e.id === editingId)
      const idx = sorted.findIndex((e) => e.id === editingId)
      const before = sorted[idx - 1]
      const after = sorted[idx + 1]
      if (before && draft.date < before.date) errors.push(`Date cannot be earlier than the previous entry (${before.date}).`)
      if (after && draft.date > after.date) errors.push(`Date cannot be later than the next entry (${after.date}).`)
      void me
    }
    void prevOne
  }

  // Fuel cannot rise on its own.
  if (!errors.length && draft.type !== 'opening') {
    const idx = editingId == null ? others.length : sorted.findIndex((e) => e.id === editingId)
    const prev = (editingId == null ? others : sorted.slice(0, idx))[(editingId == null ? others.length : idx) - 1]
    if (prev) {
      const prevLevel = levels(prev).after
      const lvl = draft.type === 'topup' ? amount(draft.before) : amount(draft.level)
      if (lvl > prevLevel) warnings.push(`This is ${round(lvl - prevLevel, 1)} L higher than the last recorded level (${prevLevel} L). Fuel cannot rise without a top-up. Check the reading.`)
    }
  }
  return { errors, warnings }
}

export function periodsCsvRows(periods, genLabel = '') {
  const rows = [['Generator', 'From', 'To (refill day)', 'Days', 'Consumed (L)', 'Hours run', 'L per hour', 'Entry', 'Before (L)', 'After (L)', 'Added (L)', 'Days not submitted']]
  periods.forEach((p) => {
    const { before, after } = levels(p.entry)
    rows.push([genLabel, p.from, p.to, p.days, p.consumed, p.hours, p.lph != null ? round(p.lph, 2) : '', p.entry.type, before, after, p.added, p.notSubmitted])
  })
  return rows
}
