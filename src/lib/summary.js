export const SECTIONS = [
  {
    title: 'Rooms',
    fields: [
      { key: 'occupied', label: 'Rooms occupied' },
      { key: 'checkOut', label: 'Check-outs' },
      { key: 'reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'Food',
    fields: [
      { key: 'foodSale', label: 'Food sale (₹)', money: true },
      { key: 'buffet', label: 'Buffet (covers)' },
      { key: 'inHouseGuests', label: 'In-house guests' },
    ],
  },
  {
    title: 'Finance',
    fields: [
      { key: 'cashReceipt', label: 'Cash receipt (₹)', money: true },
      { key: 'upiReceipts', label: 'UPI receipts (₹)', money: true },
      { key: 'cardReceipts', label: 'Card receipts (₹)', money: true },
      { key: 'bankTransfers', label: 'Bank transfers (₹)', money: true },
      { key: 'billToCompany', label: 'Bill to Company (₹)', money: true },
      { key: 'totalReceipts', label: 'Total receipts (₹)', auto: true },
      { key: 'cashExpenses', label: 'Cash expenses (₹)', money: true },
    ],
  },
  {
    title: 'Power',
    fields: [
      { key: 'gen45Hrs', label: '45 KW generator hours', decimal: true },
      { key: 'gen82Hrs', label: '82 KW generator hours', decimal: true },
    ],
  },
]

export const INPUT_KEYS = SECTIONS.flatMap((s) => s.fields).filter((f) => !f.auto).map((f) => f.key)

export const STATUS = {
  draft: { label: 'Draft', cls: 'bg-stone-200 text-stone-700' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-800' },
  verified: { label: 'Verified', cls: 'bg-green-100 text-green-800' },
  missing: { label: 'Not filled', cls: 'bg-red-100 text-red-700' },
}


// Fields calculated from the entered ones (never typed by hand).
export const totalReceipts = (v) =>
  ['cashReceipt', 'upiReceipts', 'cardReceipts', 'bankTransfers', 'billToCompany'].reduce((a, k) => a + (Number(v?.[k]) || 0), 0)

export const FINANCE_KEYS = ['cashReceipt', 'upiReceipts', 'cardReceipts', 'bankTransfers', 'billToCompany', 'cashExpenses']

export const financeVerifiedCount = (d) =>
  d?.status === 'verified'
    ? FINANCE_KEYS.length // a fully verified day counts as all fields verified (also days verified before newer fields were added)
    : FINANCE_KEYS.filter((k) => d?.fieldVerified?.[k]).length

// A submitted day is "unverified" until Management verifies the whole summary.
export const isUnverified = (d) => d?.status === 'submitted'
