// All hotel dates are IST (Asia/Kolkata), whatever the phone's own timezone is.
const TZ = 'Asia/Kolkata'

export function istParts(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    }).formatToParts(d).map((x) => [x.type, x.value])
  )
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 }
}

export const todayIST = () => istParts().date

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const yesterdayIST = () => addDays(todayIST(), -1)

// Yesterday's summary becomes due at 10:00 AM IST today.
export const isDuePassed = () => istParts().hour >= 10

export function prettyDate(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Whole days from dateStr to today (IST); 0 = today.
export function daysAgo(dateStr) {
  const a = Date.UTC(...dateStr.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
  const b = Date.UTC(...todayIST().split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
  return Math.round((b - a) / 86400000)
}

export const ageLabel = (dateStr) => {
  const d = daysAgo(dateStr)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}
