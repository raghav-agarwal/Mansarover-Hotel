import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

const SummaryList = lazy(() => import('./pages/SummaryList'))
const SummaryDetail = lazy(() => import('./pages/SummaryDetail'))
const SummaryMonth = lazy(() => import('./pages/SummaryMonth'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Users = lazy(() => import('./pages/Users'))

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-stone-500">Loading…</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />

          <Route element={<ProtectedRoute area="summary" />}>
            <Route path="summary" element={<SummaryList />} />
            <Route path="summary/month/:month" element={<SummaryMonth />} />
            <Route path="summary/:date" element={<SummaryDetail />} />
          </Route>

          <Route element={<ProtectedRoute area="users" />}>
            <Route path="users" element={<Users />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
