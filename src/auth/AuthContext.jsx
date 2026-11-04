import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { hashPin, isValidPin, newSalt } from '../lib/pin'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15
const STORAGE_KEY = 'mansarover.userId'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

const publicUser = (id, data) => ({
  id,
  username: data.username,
  name: data.name,
  phone: data.phone,
  role: data.role,
  active: data.active !== false,
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the saved session so staff stay signed in on their phone.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const id = localStorage.getItem(STORAGE_KEY)
        if (id) {
          const snap = await getDoc(doc(db, 'users', id))
          if (!cancelled && snap.exists() && snap.data().active !== false) {
            setUser(publicUser(snap.id, snap.data()))
          } else {
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch {
        // offline or storage blocked: fall back to the login screen
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (usernameInput, pin) => {
    const username = usernameInput.trim().toLowerCase()
    if (!username || !isValidPin(pin)) {
      throw new Error('Enter your username and a 4-digit PIN.')
    }
    const q = query(collection(db, 'users'), where('username', '==', username), limit(1))
    const res = await getDocs(q)
    if (res.empty) throw new Error('Wrong username or PIN.')

    const snap = res.docs[0]
    const data = snap.data()
    if (data.active === false) throw new Error('This account is disabled. Contact management.')

    const now = Date.now()
    if (data.lockedUntil && data.lockedUntil > now) {
      const mins = Math.ceil((data.lockedUntil - now) / 60000)
      throw new Error(`Too many wrong attempts. Try again in ${mins} min.`)
    }

    const hash = await hashPin(pin, data.pinSalt)
    if (hash !== data.pinHash) {
      const attempts = (data.failedAttempts || 0) + 1
      const patch = { failedAttempts: attempts }
      if (attempts >= MAX_ATTEMPTS) {
        patch.failedAttempts = 0
        patch.lockedUntil = now + LOCK_MINUTES * 60000
      }
      await updateDoc(snap.ref, patch)
      throw new Error(
        attempts >= MAX_ATTEMPTS
          ? `Too many wrong attempts. Locked for ${LOCK_MINUTES} min.`
          : 'Wrong username or PIN.'
      )
    }

    if (data.failedAttempts || data.lockedUntil) {
      await updateDoc(snap.ref, { failedAttempts: 0, lockedUntil: 0 })
    }
    localStorage.setItem(STORAGE_KEY, snap.id)
    setUser(publicUser(snap.id, data))
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// First-run helper: true when no users exist yet, so the login page can offer to create the first
// Management account.
export async function hasAnyUser() {
  const res = await getDocs(query(collection(db, 'users'), limit(1)))
  return !res.empty
}

export async function createUser({ username, name, phone, role, pin }) {
  const uname = username.trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,}$/.test(uname)) {
    throw new Error('Username needs 3+ letters, numbers, dot, dash or underscore.')
  }
  if (!name.trim()) throw new Error('Name is required.')
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits.')

  const taken = await getDocs(query(collection(db, 'users'), where('username', '==', uname), limit(1)))
  if (!taken.empty) throw new Error('That username is already taken.')

  const pinSalt = newSalt()
  const pinHash = await hashPin(pin, pinSalt)
  const ref = doc(collection(db, 'users'))
  await setDoc(ref, {
    username: uname,
    name: name.trim(),
    phone: phone.trim(),
    role,
    active: true,
    pinSalt,
    pinHash,
    failedAttempts: 0,
    lockedUntil: 0,
    createdAt: Date.now(),
  })
  return ref.id
}
