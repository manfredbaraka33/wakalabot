// import { Link } from 'react-router-dom'
// import { LayoutGrid } from 'lucide-react'
// import WakalaLogo from './Wakalalogo'

// export default function ToolsNav() {
//   return (
//     <nav className="border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-40">
//       <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
//         <Link to="/" className="min-w-0 shrink overflow-hidden" aria-label="Wakalabot">
//           <WakalaLogo />
//         </Link>

//         <div className="flex items-center gap-2 sm:gap-4 shrink-0">
//           <Link
//             to="/tools"
//             title="Zana zote"
//             aria-label="Zana zote"
//             className="flex items-center justify-center gap-1.5 w-10 h-10 sm:w-auto sm:h-auto rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 sm:hover:bg-transparent transition-colors"
//           >
//             <LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4" />
//             <span className="hidden sm:inline text-sm">Zana zote</span>
//           </Link>

//           <Link
//             to="/register"
//             className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white whitespace-nowrap transition-colors"
//           >
//             Jisajili<span className="hidden sm:inline"> bure</span>
//           </Link>
//         </div>
//       </div>
//     </nav>
//   )
// }

import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import WakalaLogo from './Wakalalogo'
import ThemeToggle from './ThemeToggle'

export default function ToolsNav() {
  return (
    <nav className="border-b border-gray-800 bg-gray-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        <Link to="/" className="min-w-0 shrink overflow-hidden" aria-label="Wakalabot">
          <WakalaLogo />
        </Link>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <Link
            to="/tools"
            title="Zana zote"
            aria-label="Zana zote"
            className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 sm:hover:bg-transparent transition-colors"
          >
            <LayoutGrid className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline text-sm">Zana zote</span>
          </Link>

          <ThemeToggle />

          <Link
            to="/register"
            className="ml-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white whitespace-nowrap transition-colors"
          >
            Jisajili<span className="hidden sm:inline"> bure</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}