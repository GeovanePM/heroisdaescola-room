import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { trpc, makeTrpcClient } from './lib/trpc'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import Landing             from './pages/Landing'
import Login               from './pages/Login'
import CheckIn             from './pages/CheckIn'
import HeroVote            from './pages/HeroVote'
import AppLayout           from './pages/app/Layout'
import TeacherDashboard    from './pages/app/TeacherDashboard'
import SupervisorDashboard from './pages/app/SupervisorDashboard'
import DirectorPanel       from './pages/app/DirectorPanel'
import QRCodes             from './pages/app/QRCodes'
import AdminPanel          from './pages/app/AdminPanel'
import SuperAdminPanel     from './pages/app/SuperAdminPanel'
import ReportsPanel        from './pages/app/ReportsPanel'
import GamesHub            from './pages/app/GamesHub'
import RankingTV           from './pages/RankingTV'
import DirectorTV          from './pages/DirectorTV'

function ProtectedRoute({ children, roles }) {
  const { isAuth, user } = useAuth()
  if (!isAuth) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/app/sala" replace />
  return children
}

function AppProviders() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))
  const [trpcClient] = useState(() => makeTrpcClient())

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/"           element={<Landing />} />
            <Route path="/login"      element={<Login />} />
            <Route path="/ranking-tv" element={<RankingTV />} />
            <Route path="/director-tv" element={
              <ProtectedRoute roles={['director','admin','vice_director','supervisor']}>
                <DirectorTV />
              </ProtectedRoute>
            } />
            <Route path="/check-in/:classroomId" element={<CheckIn />} />
            <Route path="/vote/:classroomId"     element={<HeroVote />} />

            <Route path="/app" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="sala" replace />} />
              <Route path="sala"       element={<ProtectedRoute roles={['teacher','admin']}><TeacherDashboard /></ProtectedRoute>} />
              <Route path="supervisor" element={<ProtectedRoute roles={['supervisor','vice_director','director','admin']}><SupervisorDashboard /></ProtectedRoute>} />
              <Route path="diretor"    element={<ProtectedRoute roles={['director','admin']}><DirectorPanel /></ProtectedRoute>} />
              <Route path="qrcodes"   element={<ProtectedRoute roles={['director','admin','supervisor']}><QRCodes /></ProtectedRoute>} />
              <Route path="ranking-tv" element={<RankingTV />} />
              <Route path="admin"     element={<ProtectedRoute roles={['admin']}><AdminPanel /></ProtectedRoute>} />
              <Route path="super"     element={<ProtectedRoute roles={['super_admin']}><SuperAdminPanel /></ProtectedRoute>} />
              <Route path="relatorios" element={<ProtectedRoute roles={['director','admin','vice_director']}><ReportsPanel /></ProtectedRoute>} />
              <Route path="games"     element={<GamesHub />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppProviders />
    </AuthProvider>
  )
}
