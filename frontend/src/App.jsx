import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import Register from './pages/Register'
import Login from './pages/Login'
import Overview from './features/dashboard/Overview'
import ShopSettings from './features/onboarding/ShopSettings'
import KnowledgeBase from './features/dashboard/KnowledgeBase'
import Products from './features/dashboard/Products'
import Analytics from './pages/Analytics'
import Billing from './pages/Billing'
import Conversations from './pages/Conversations'
import Support from './pages/Support'
import AccountSettings from './pages/AccountSettings'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import SuperAdminLogin from './features/superadmin/SuperAdminLogin'
import SuperAdminLayout from './features/superadmin/SuperAdminLayout'
import SuperAdminDashboard from './features/superadmin/SuperAdminDashboard'
import SuperAdminTenants from './features/superadmin/SuperAdminTenants'
import SuperAdminTransactions from './features/superadmin/SuperAdminTransactions'
import SuperAdminWallets from './features/superadmin/SuperAdminWallets'
import SuperAdminTickets from './features/superadmin/SuperAdminTickets'
import CustomerChat from './pages/CustomerChat'
import useTenantStore from './store/useTenantStore'
import LeadsPage from './pages/LeadsPage'
import SuperAdminPayments from './features/superadmin/SuperAdminPayments'
import SuperAdminCustomers from './features/superadmin/SuperAdminCustomers'
import SuperAdminBroadcast from './features/superadmin/SuperAdminBroadcast'
import SuperAdminFeedback from './features/superadmin/SuperAdminFeedback'
import UnansweredQuestions from './features/dashboard/UnansweredQuestions'
import InfoSettings from './features/onboarding/InfoSettings'
import InstallPrompt from './components/InstallPrompt'
import RootEntry from './components/RootEntry'
import UpdateToast from './components/UpdateToast'
import AppHome from './pages/AppHome'
import StudioPriceList from './studio/StudioPriceList'
import StudioVideo from './studio/StudioVideo'


import { Outlet } from 'react-router-dom'
import { StudioProvider } from './studio/StudioContext'
import StudioShell from './studio/StudioShell'
import StudioHome from './studio/StudioHome'
import { StudioSignup, StudioLogin, StudioForgot } from './studio/StudioAuth'
import StudioCreate from './studio/StudioCreate'
import StudioLibrary from './studio/StudioLibrary'
import StudioWallet from './studio/StudioWallet'
import StudioAccount from './studio/StudioAccount'
import SuperAdminStudio from './features/superadmin/SuperAdminStudio'


const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function ProtectedRoute({ children }) {
  const token = useTenantStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Rendered globally across all routes */}
        <InstallPrompt />
        <UpdateToast />
        <Routes>
          {/* Landing */}
          <Route path="/" element={<RootEntry />} />
          <Route path="/home" element={<AppHome />} />

          {/* Consumer chat — public */}
          <Route path="/chat" element={<CustomerChat />} />
          <Route path="/chat/:slug" element={<CustomerChat />} />

          {/* Public auth */}
          <Route path="/signin" element={<Login />} />
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          
          <Route path="/tools/*" element={<Navigate to="/studio" replace />} />


          <Route path="/studio" element={<StudioProvider><Outlet /></StudioProvider>}>
          <Route index element={<StudioHome />} />
          <Route path="signup" element={<StudioSignup />} />
          <Route path="login" element={<StudioLogin />} />
          <Route path="forgot" element={<StudioForgot />} />
          <Route path="app" element={<StudioShell />}>
            <Route index element={<StudioCreate />} />
            <Route path="library" element={<StudioLibrary />} />
            <Route path="credits" element={<StudioWallet />} />
            <Route path="account" element={<StudioAccount />} />
            <Route path="price-list" element={<StudioPriceList />} />
            <Route path="video" element={<StudioVideo />} />
          </Route>
        </Route>

          {/* Tenant dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="settings" element={<ShopSettings />} />
            <Route path="knowledge" element={<KnowledgeBase />} />
            <Route path="infosettings" element={<InfoSettings />} />
            <Route path="products" element={<Products />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="billing" element={<Billing />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="support" element={<Support />} />
            <Route path="account" element={<AccountSettings />} />
            <Route path="unanswered" element={<UnansweredQuestions />} />
          </Route>

          {/* SuperAdmin */}
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin" element={<SuperAdminLayout />}>
            <Route index element={<SuperAdminDashboard />} />
            <Route path="tenants" element={<SuperAdminTenants />} />
            <Route path="studio" element={<SuperAdminStudio />} />
            <Route path="transactions" element={<SuperAdminTransactions />} />
            <Route path="wallets" element={<SuperAdminWallets />} />
            <Route path="tickets" element={<SuperAdminTickets />} />
            <Route path="payments" element={<SuperAdminPayments />} />
            <Route path="customers" element={<SuperAdminCustomers />} />
            <Route path="broadcast" element={<SuperAdminBroadcast />} />
            <Route path="feedback" element={<SuperAdminFeedback />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}