import { Link } from 'react-router-dom'

export default function MiniFooter() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900/50 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>© {new Date().getFullYear()} Wakalabot Services</span>
        <Link to="/terms" className="hover:text-gray-400 transition-colors">Masharti</Link>
        <Link to="/privacy" className="hover:text-gray-400 transition-colors">Faragha</Link>
        <a href="https://wa.me/255712750468" className="hover:text-gray-400 transition-colors">Msaada</a>
      </div>
    </footer>
  )
}