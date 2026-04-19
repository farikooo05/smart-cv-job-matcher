import { Routes, Route } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import type { ReactNode } from 'react'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Dashboard Pages
import DashboardLayout from './layouts/DashboardLayout'
import DashboardOverview from './pages/dashboard/DashboardOverview'
import AnalyzePage from './pages/dashboard/AnalyzePage'
import ResultsPage from './pages/dashboard/ResultsPage'
import InsightsPage from './pages/dashboard/InsightsPage'
import HistoryPage from './pages/dashboard/HistoryPage'
import MatchesPage from './pages/dashboard/MatchesPage'
import ProfilePage from './pages/dashboard/ProfilePage'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

const GoogleWrapper = ({ children }: { children: ReactNode }) => {
  if (!GOOGLE_CLIENT_ID) return <>{children}</>
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
}

const App = () => {
  return (
    <GoogleWrapper>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="analyze" element={<AnalyzePage />} />
              <Route path="matches" element={<MatchesPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="results/:id" element={<ResultsPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="history" element={<HistoryPage />} />
            </Route>
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
    </GoogleWrapper>
  )
}

export default App

