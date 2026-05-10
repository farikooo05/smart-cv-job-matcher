import { Routes, Route } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'


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
import SubscriptionPage from './pages/dashboard/SubscriptionPage'


const App = () => {
  return (
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
              <Route path="subscription" element={<SubscriptionPage />} />
            </Route>
          </Route>
        </Routes>
        <Toaster />
      </AuthProvider>
  )
}

export default App

