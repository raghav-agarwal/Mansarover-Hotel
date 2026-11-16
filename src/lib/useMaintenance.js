import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// Live room types, rooms and checklist items. `loading` is true until all three have arrived.
export function useMaintenance() {
  const [types, setTypes] = useState(null)
  const [rooms, setRooms] = useState(null)
  const [items, setItems] = useState(null)

  useEffect(() => {
    const read = (name, set, sort) =>
      onSnapshot(collection(db, name), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        set(sort ? list.sort(sort) : list)
      })
    const offs = [
      read('roomTypes', setTypes, (a, b) => (a.order || 0) - (b.order || 0)),
      read('rooms', setRooms),
      read('checklistItems', setItems, (a, b) => (a.order || 0) - (b.order || 0)),
    ]
    return () => offs.forEach((off) => off())
  }, [])

  return {
    loading: types === null || rooms === null || items === null,
    types: types || [],
    rooms: rooms || [],
    items: items || [],
  }
}

// Submitted checklists and in-progress drafts (one draft per room, document id = room id).
export function useChecks() {
  const [checks, setChecks] = useState(null)
  const [drafts, setDrafts] = useState(null)

  useEffect(() => {
    const read = (name, set) =>
      onSnapshot(collection(db, name), (snap) => set(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    const offs = [read('maintenanceChecks', setChecks), read('maintenanceDrafts', setDrafts)]
    return () => offs.forEach((off) => off())
  }, [])

  return { loading: checks === null || drafts === null, checks: checks || [], drafts: drafts || [] }
}

// Newest submitted check per room id.
export function latestByRoom(checks) {
  const out = {}
  for (const c of checks) {
    const cur = out[c.roomId]
    if (!cur || c.date > cur.date || (c.date === cur.date && (c.submittedAt || 0) > (cur.submittedAt || 0))) out[c.roomId] = c
  }
  return out
}
