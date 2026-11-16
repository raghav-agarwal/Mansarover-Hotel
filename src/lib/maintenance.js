import { collection, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

export const SECTIONS = { room: 'Room', washroom: 'Washroom' }

export const DEFAULT_TYPES = ['AC Deluxe', 'Royal Deluxe', 'Super Deluxe', 'Luxury']

export const DEFAULT_ROOMS = {
  'AC Deluxe': ['G 3', 'G 4', 'G 6', '107', '204', '205'],
  'Royal Deluxe': [
    'G 1', 'G 2', 'G 5', '104', '105', '106', '108', '109', '110', '111', '112', '113', '114',
    '206', '207', '208', '209', '210', '211', '212', '213', '214',
  ],
  'Super Deluxe': ['101', '103', '201', '202', '203'],
  Luxury: ['115', '116', '215', '216'],
}

// Every room type starts with this checklist; Management can then change each type separately.
export const DEFAULT_ITEMS = {
  room: [
    'Mattress', 'Bedsheet', 'Rug', 'Pillow', 'Side Table', 'Bed Back', 'Sofa', 'Center Table',
    'AC', 'Lights', 'Fan', 'Door Handles', 'Windows', 'Curtains', 'Mirror',
  ],
  washroom: ['Mirror', 'Cistern', 'Leakage', 'Washbasin', 'Geyser', 'Lights'],
}

export const cleanRoomNo = (s) => String(s).trim().replace(/\s+/g, ' ').toUpperCase()
export const roomKey = (s) => cleanRoomNo(s).replace(/\s/g, '')

export function floorOf(no) {
  const k = roomKey(no)
  if (k.startsWith('G')) return 'Ground floor'
  return /^\d/.test(k) ? `Floor ${k[0]}` : 'Other'
}

// Ground-floor rooms first (G 1, G 2 ...), then 101, 102 ... 216.
export function compareRooms(a, b) {
  const ka = roomKey(a)
  const kb = roomKey(b)
  const ga = ka.startsWith('G') ? 0 : 1
  const gb = kb.startsWith('G') ? 0 : 1
  if (ga !== gb) return ga - gb
  const na = parseInt(ka.replace(/\D/g, ''), 10)
  const nb = parseInt(kb.replace(/\D/g, ''), 10)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return ka.localeCompare(kb)
}

// Loads the hotel's 4 room types, 37 rooms and a checklist per type. Refuses to run twice.
export async function seedDefaults() {
  const existing = await getDocs(query(collection(db, 'roomTypes'), limit(1)))
  if (!existing.empty) throw new Error('Room types already exist. Defaults were not loaded again.')

  const batch = writeBatch(db)
  const now = Date.now()
  DEFAULT_TYPES.forEach((name, i) => {
    const typeRef = doc(collection(db, 'roomTypes'))
    batch.set(typeRef, { name, order: i, active: true })
    DEFAULT_ROOMS[name].forEach((number) => {
      batch.set(doc(collection(db, 'rooms')), { number, typeId: typeRef.id, active: true, createdAt: now })
    })
    Object.entries(DEFAULT_ITEMS).forEach(([section, labels]) => {
      labels.forEach((label, order) => {
        batch.set(doc(collection(db, 'checklistItems')), { typeId: typeRef.id, section, label, order, active: true })
      })
    })
  })
  await batch.commit()
}
