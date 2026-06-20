import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  Receipt,
  Wallet,
  Ticket,
  LogOut,
  BotMessageSquare,
  Menu,
  X,
  ShieldCheck,
  Coins,
  Send,
  MessageSquare
} from 'lucide-react'
import { clearSAToken, getSAToken } from '../../api/superadmin'
import { Navigate } from 'react-router-dom'

const NAV = [
  { to: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/tenants', label: 'Tenants', icon: Users },
  { to: '/superadmin/transactions', label: 'Transactions', icon: Receipt },
  { to: '/superadmin/wallets', label: 'Wallets', icon: Wallet },
  { to: '/superadmin/tickets', label: 'Support Tickets', icon: Ticket },
  { to: '/superadmin/payments', label: 'Payments', icon: Coins },
  { to: '/superadmin/customers', label: 'Customers', icon: Users },
  { to: '/superadmin/broadcast', label: 'Broadcast', icon: Send },
  { to: '/superadmin/feedback', label: 'Feedback', icon: MessageSquare }
]

function NavItem({ to, label, icon: Icon, end, onClose }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[#6366f1]/15 text-[#6366f1]'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  )
}

export default function SuperAdminLayout() {
  const token = getSAToken()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!token) return <Navigate to="/superadmin/login" replace />

  function handleLogout() {
    clearSAToken()
    navigate('/superadmin/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gray-900 border-r border-gray-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-gray-800 px-5">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center">
            <BotMessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">WakalaBot</p>
            <p className="text-xs text-[#6366f1] font-medium">Nerve Center</p>
          </div>
        </div>

        {/* Admin badge */}
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-amber-400/10 border border-amber-400/20 px-3 py-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-amber-400">SuperAdmin Access</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} onClose={() => setOpen(false)} />
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-800 p-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-white text-sm">Nerve Center</span>
          <div />
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
