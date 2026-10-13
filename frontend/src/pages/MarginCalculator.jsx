import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowRight } from 'lucide-react'
import WakalaLogo from '../components/Wakalalogo'
import ToolsNav from '../components/ToolsNav'

export default function MarginCalculator() {
  const [mode, setMode] = useState('margin') // 'margin' | 'target'
  const [cost, setCost] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [targetMarginPct, setTargetMarginPct] = useState('')

  const result = useMemo(() => {
    const c = parseFloat(cost) || 0
    if (mode === 'margin') {
      const s = parseFloat(sellingPrice) || 0
      if (c <= 0 || s <= 0) return null
      const profit = s - c
      const marginPct = (profit / s) * 100
      const markupPct = (profit / c) * 100
      return { profit, marginPct, markupPct, sellingPrice: s }
    } else {
      const targetPct = parseFloat(targetMarginPct) || 0
      if (c <= 0 || targetPct <= 0 || targetPct >= 100) return null
      const requiredPrice = c / (1 - targetPct / 100)
      const profit = requiredPrice - c
      return { requiredPrice, profit, targetPct }
    }
  }, [mode, cost, sellingPrice, targetMarginPct])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToolsNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-8 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Kikokotoo cha Faida</h1>
          <p className="text-sm text-gray-400">Jua faida yako halisi, au bei unayotakiwa kuuza ili kufikia faida unayotaka.</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('margin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === 'margin' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-gray-700 text-gray-400'
              }`}
            >
              Nina Bei — Hesabu Faida
            </button>
            <button
              onClick={() => setMode('target')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === 'target' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-gray-700 text-gray-400'
              }`}
            >
              Nataka Faida — Hesabu Bei
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bei ya Ununuzi (Cost) — TZS</label>
            <input
              type="number"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {mode === 'margin' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Bei ya Kuuza — TZS</label>
              <input
                type="number"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Faida Unayotaka (%)</label>
              <input
                type="number"
                value={targetMarginPct}
                onChange={e => setTargetMarginPct(e.target.value)}
                placeholder="e.g. 30"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {result && mode === 'margin' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Faida (TZS)</span>
                <span className="text-white font-bold">{result.profit.toLocaleString()} TZS</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Margin (% ya bei ya kuuza)</span>
                <span className="text-emerald-400 font-bold">{result.marginPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Markup (% ya gharama)</span>
                <span className="text-indigo-400 font-bold">{result.markupPct.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {result && mode === 'target' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Bei Unayotakiwa Kuuza</span>
                <span className="text-white font-bold">{result.requiredPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} TZS</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Faida Utakayopata</span>
                <span className="text-emerald-400 font-bold">{result.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })} TZS</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-gray-400">
            Hii ni moja tu ya zana za Wakalabot. Fungua akaunti bure na upate AI
            inayojibu wateja wako moja kwa moja, masaa 24 kwa siku.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
            Jisajili Bure <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}