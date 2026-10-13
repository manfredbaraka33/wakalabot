import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import ToolsNav from '../components/ToolsNav'
import { TOOLS } from '../data/tools'

export default function ToolsHub() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToolsNav />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Zana za Bure kwa Wafanyabiashara</h1>
          <p className="text-sm text-gray-400">Hakuna usajili, hakuna malipo. Fungua na utumie.</p>
        </div>

        <div className="grid gap-3">
          {TOOLS.map(tool => {
            const Icon = tool.icon
            const body = (
              <div className={`flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl p-4 transition-colors ${
                tool.soon ? 'opacity-50' : 'hover:border-indigo-500/50'
              }`}>
                <div className={`w-12 h-12 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-6 h-6 ${tool.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{tool.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tool.desc}</p>
                </div>
                {tool.soon ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 border border-gray-700 rounded-full px-2 py-0.5 shrink-0">
                    Inakuja
                  </span>
                ) : (
                  <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
                )}
              </div>
            )
            return tool.soon ? <div key={tool.path}>{body}</div> : <Link key={tool.path} to={tool.path}>{body}</Link>
          })}
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-gray-400">
            Unataka AI inayojibu wateja wako masaa 24, na kukutumia SMS mteja akitaka kununua?
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
            Jisajili Bure <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}