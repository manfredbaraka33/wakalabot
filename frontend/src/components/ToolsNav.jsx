import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import WakalaLogo from './Wakalalogo'

export default function ToolsNav() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/"><WakalaLogo /></Link>
        <div className="flex items-center gap-4">
          <Link to="/tools" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
            <LayoutGrid className="w-4 h-4" /> Zana zote
          </Link>
          <Link to="/register" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            Jisajili bure →
          </Link>
        </div>
      </div>
    </nav>
  )
}