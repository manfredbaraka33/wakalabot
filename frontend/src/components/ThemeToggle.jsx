import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Washa mwanga' : 'Washa giza'}
      aria-label={isDark ? 'Badilisha kuwa mwanga' : 'Badilisha kuwa giza'}
      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}