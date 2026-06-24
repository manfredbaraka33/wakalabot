import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Settings,
  MessageSquare,
  BarChart3,
  LogOut,
  BotMessageSquare,
  Menu,
  BookOpen,
  Package,
  Coins,
  Ticket,
  KeyRound,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  FlameIcon,
  HelpCircle
} from 'lucide-react'
import useTenantStore from '../store/useTenantStore'
import Footer from './Footer'
import { useTheme } from '../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { to: '/dashboard/products', label: 'Products & Services', icon: Package },
  { to: '/dashboard/settings', label: 'Shop Settings', icon: Settings },
  { to: '/dashboard/conversations', label: 'Conversations', icon: MessageSquare },
  { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/dashboard/billing', label: 'Billing & Wallet', icon: Coins },
  { to: '/dashboard/leads', label: 'Leads', icon: FlameIcon },
  { to: '/dashboard/support', label: 'Support', icon: Ticket },
  // { to: '/dashboard/unanswered', label: 'Maswali Bila Majibu', icon: HelpCircle }
]

function SidebarNavItem({ to, label, icon: Icon, end, onNavigate, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-indigo-500/15 text-indigo-400'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && label}
    </NavLink>
  )
}


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import apiClient from '../api/axios'
import { useState as useStateN } from 'react'
import WakalaLogo from './Wakalalogo'

function NotificationBell() {
  const [open, setOpen] = useStateN(false)
  const qc = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => apiClient.get('/api/v1/notifications/unread-count').then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/api/v1/notifications').then(r => r.data),
    enabled: open,
  })

  const markAll = useMutation({
    mutationFn: () => apiClient.post('/api/v1/notifications/mark-all-read'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-count'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const count = countData?.count ?? 0

  const typeIcon = (type) => {
    if (type === 'new_lead') return '🔥'
    if (type === 'insight') return '💡'
    if (type === 'escalation') return '⚠️'
    if (type === 'complaint') return '😟'
    return '🔔'
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] font-bold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-40 flex items-start justify-center pt-20 px-4 sm:absolute sm:inset-auto sm:right-0 sm:top-10 sm:pt-0 sm:px-0 sm:flex-none sm:block pointer-events-none">
            <div className="w-full max-w-sm sm:w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <p className="text-sm font-semibold text-white">Notifications</p>
              {count > 0 && (
                <button onClick={() => markAll.mutate()} className="text-xs text-indigo-400 hover:text-indigo-300">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No notifications yet</p>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors ${!n.is_read ? 'bg-indigo-500/5' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{typeIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(n.created_at).toLocaleString('en-TZ', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-1" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  )
}



export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useTenantStore()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  function handleLogout() {
    logout()
    navigate('/signin')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'w-16' : 'w-64'}`}
      >

        
        {/* Logo */}
      <div className={`flex h-16 shrink-0 items-center border-b border-gray-800 ${
        collapsed ? 'justify-center px-3' : 'gap-2.5 px-5'
      }`}>
        {collapsed ? (
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <img 
            src="/wakalabot_logo.png" 
            alt="WakalaBot Logo" 
            className="w-8 h-8 rounded-2xl object-cover shadow-lg shadow-emerald-900/40"
          />  
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <WakalaLogo className="w-8 h-8" />
            
          </div>
        )}
      </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.to}
              {...item}
              collapsed={collapsed}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-800 p-2 space-y-1">
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
            }
          </button>

          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-800 bg-gray-900 px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />
          
          <NotificationBell />

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          
          {/* User badge — clickable, goes to account page */}
          <button
            onClick={() => navigate('/dashboard/account')}
            className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-gray-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-indigo-400 leading-none">
                {(user?.username ?? user?.email ?? 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white leading-none">
                {user?.business_name ?? 'My Business'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">
                @{user?.username ?? user?.email ?? '—'}
              </p>
            </div>
          </button>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  )
}