import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function ToolCta() {
  return (
    <div className="mt-10 bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
      <p className="text-sm text-gray-400">
        Hii ni moja tu ya zana za Wakalabot. Fungua akaunti bure na upate AI
        inayojibu wateja wako moja kwa moja, masaa 24 kwa siku.
      </p>
      <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
        Jisajili Bure <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}