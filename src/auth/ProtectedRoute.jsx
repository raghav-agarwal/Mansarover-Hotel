import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { can } from '../lib/roles'

// Wrap routes with <ProtectedRoute /> to require login, or <ProtectedRoute area="users" />
// to also require access to that area.
export default function ProtectedRoute({ area }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-stone-500">Loading…</div>
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (area && !can(user, area)) return <Navigate to="/" replace />
  return <Outlet />
}
