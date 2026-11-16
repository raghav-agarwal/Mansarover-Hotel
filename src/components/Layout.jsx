import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { can, ROLES } from '../lib/roles'

export default function Layout() {
  const { user, logout } = useAuth()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const items = [
    { to: '/', label: 'Home', show: true, end: true },
    { to: '/summary', label: 'Summary', show: can(user, 'summary') },
    { to: '/tasks', label: 'Tasks', show: can(user, 'tasks') },
    { to: '/maintenance', label: 'Maintenance', show: can(user, 'maintenance') },
    { to: '/generator', label: 'Generator', show: can(user, 'generator') },
    { to: '/users', label: 'Users', show: can(user, 'users') },
  ].filter((i) => i.show)

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-amber-900 px-4 py-3 text-white">
        <div>
          <p className="font-semibold leading-tight">Hotel Mansarover</p>
          <p className="text-xs text-amber-200">
            {user.name} · {ROLES[user.role]}
          </p>
        </div>
        <button onClick={logout} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm active:bg-white/25">
          Sign out
        </button>
      </header>

      {!online && (
        <p className="bg-stone-800 px-4 py-2 text-center text-sm text-white">
          You're offline. Changes will sync when you're back online.
        </p>
      )}

      <main className="flex-1 px-4 pb-24 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-3xl">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}
              className={({ isActive }) =>
                `flex-1 px-0.5 py-3 text-center text-[11px] min-[400px]:text-[13px] font-medium ${isActive ? 'text-amber-800' : 'text-stone-500'}`
              }>
              {i.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
