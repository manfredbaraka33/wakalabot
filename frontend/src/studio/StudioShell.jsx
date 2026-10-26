import { Link, NavLink, Navigate, Outlet } from 'react-router-dom'
import { Coins, FolderOpen, Loader2, Receipt, Sparkles, User } from 'lucide-react'
import WakalaLogo from '../components/Wakalalogo'
import { useStudio } from './StudioContext'
import ThemeToggle from '../components/ThemeToggle'
import MiniFooter from '../components/MiniFooter'

const TABS = [
  { to: '/studio/app', label: 'Tangazo', short: 'Tangazo', icon: Sparkles, end: true },
  { to: '/studio/app/price-list', label: 'Orodha ya Bei', short: 'Orodha', icon: Receipt, free: false },
  { to: '/studio/app/library', label: 'Kazi Zangu', short: 'Kazi', icon: FolderOpen },
  { to: '/studio/app/credits', label: 'Credits', short: 'Credits', icon: Coins },
  { to: '/studio/app/account', label: 'Akaunti', short: 'Akaunti', icon: User },
]

export default function StudioShell() {
  const { token, creator, loading, signOut } = useStudio()

  if (!token) return <Navigate to="/studio/login" replace />
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Inapakia…
      </div>
    )
  }
  if (!creator) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-gray-300">Akaunti haipatikani au imesimamishwa. Wasiliana na support.</p>
        <button onClick={signOut} className="text-sm text-indigo-400 hover:underline">Toka</button>
      </div>
    )
  }

  const low = creator.credits < 5
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/studio/app" className="flex items-center gap-2 min-w-0">
            <span className="min-w-0 overflow-hidden"><WakalaLogo /></span>
            {/* <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 bg-fuchsia-500/15 rounded-full px-2 py-0.5 shrink-0">Studio</span> */}
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(({ to, label, icon: Icon, end, free }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-500/15 text-indigo-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <Icon className="w-4 h-4" /> {label}
                {free && <span className="text-[9px] font-bold uppercase text-emerald-500 bg-emerald-500/15 rounded-full px-1.5 py-0.5">Bure</span>}
              </NavLink>
            ))}
          </nav>
          <Link to="/studio/app/credits"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors shrink-0 ${
              low ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
            <Coins className="w-4 h-4" /> {creator.credits.toLocaleString()}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-28 md:pb-10">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-800 bg-gray-900/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-5">
          {TABS.map(({ to, short, icon: Icon, end, free }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
                isActive ? 'text-indigo-300' : 'text-gray-500'}`}>
              <Icon className="w-5 h-5" /> {short}
              {free && <span className="absolute top-1 right-3 w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </NavLink>
          ))}
        </div>
      </nav>
      <MiniFooter />
    </div>
  )
}