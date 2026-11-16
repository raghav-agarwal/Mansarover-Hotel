import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/maintenance', label: 'Rooms', end: true },
  { to: '/maintenance/history', label: 'History' },
  { to: '/maintenance/reports', label: 'Reports' },
]

// Small tab strip shared by the Maintenance screens.
export default function MaintNav() {
  return (
    <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}
          className={({ isActive }) =>
            `flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${isActive ? 'bg-white shadow-sm' : 'text-stone-500'}`
          }>
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
