export const SECTIONS = [
  {
    title: 'Rooms',
    fields: [
      { key: 'occupied', label: 'Rooms occupied' },
      { key: 'walkIn', label: 'Check-ins (Walk-in)' },
      { key: 'ota', label: 'Check-ins (OTA)' },
      { key: 'totalCheckIn', label: 'Total check-in', auto: true },
      { key: 'checkOut', label: 'Check-outs' },
      { key: 'reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'Food',
    fields: [
      { key: 'foodSale', label: 'Food sale (₹)', money: true },
      { key: 'buffet', label: 'Buffet (covers)' },
    ],
  },
  {
    title: 'Finance',
    fields: [
      { key: 'cashReceipt', label: 'Cash receipt (₹)', money: true },
      { key: 'cashExpenses', label: 'Cash expenses (₹)', money: true },
    ],
  },
  {
    title: 'Power',
    fields: [{ key: 'generatorHrs', label: 'Generator hours', decimal: true }],
  },
]

export const INPUT_KEYS = SECTIONS.flatMap((s) => s.fields).filter((f) => !f.auto).map((f) => f.key)

export const STATUS = {
  draft: { label: 'Draft', cls: 'bg-stone-200 text-stone-700' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-800' },
  verified: { label: 'Verified', cls: 'bg-green-100 text-green-800' },
  missing: { label: 'Not filled', cls: 'bg-red-100 text-red-700' },
}

export const totalCheckIn = (s) => (Number(s?.walkIn) || 0) + (Number(s?.ota) || 0)
