import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Wrench, LogIn } from 'lucide-react'
import WakalaLogo from './Wakalalogo'
import ThemeToggle from './ThemeToggle'

const LINKS = [
  { to: '/tools', label: 'Zana Bure', icon: Wrench },
  { to: '/signin', label: 'Ingia', icon: LogIn },
]

export default function SiteNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const navRef = useRef(null)

  // Close the menu when the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  // Close on Escape or when tapping outside the nav
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    const onOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open])

  return (
    <nav
      ref={navRef}
      className="border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-40"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="min-w-0 shrink overflow-hidden" aria-label="Wakalabot">
          <WakalaLogo />
        </Link>

        {/* Desktop / tablet links */}
        <div className="hidden sm:flex items-center gap-5 shrink-0">
          {LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              {label}
            </Link>
          ))}
          <ThemeToggle />
          <Link
            to="/register"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Jisajili
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Funga menyu' : 'Fungua menyu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="sm:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div
          id="mobile-menu"
          className="sm:hidden absolute top-full inset-x-0 border-b border-gray-800 bg-gray-900 shadow-2xl"
        >
          <div className="px-4 py-3 space-y-1">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-400 hover:bg-gray-800 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-400" />
                {label}
              </Link>
            ))}
            <ThemeToggle />
            <Link
              to="/register"
              className="mt-2 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition-colors"
            >
              Jisajili Bure
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}