import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Loader2, ArrowRight, Info } from 'lucide-react'
import apiClient from '../api/axios'
import WakalaLogo from '../components/Wakalalogo'
import ToolsNav from '../components/ToolsNav'

const NETWORKS = [
  { id: 'mpesa', label: 'M-Pesa', color: '#43B02A' },
  { id: 'tigopesa', label: 'Tigo Pesa', color: '#0066B3' },
  { id: 'airtelmoney', label: 'Airtel Money', color: '#ED1C24' },
  { id: 'halopesa', label: 'HaloPesa', color: '#F7941D' },
]

export default function FeeCalculator() {
  const [amount, setAmount] = useState('')
  const [txnType, setTxnType] = useState('send')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCompare(e) {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) {
      setError('Weka kiasi sahihi.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.get('/api/v1/tools/mobile-money-fee/compare', {
        params: { amount: amt, transaction_type: txnType },
      })
      setResults(res.data)
    } catch {
      setError('Kuna tatizo. Tafadhali jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToolsNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-8 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto">
            <Calculator className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Linganisha Gharama za Mobile Money</h1>
          <p className="text-sm text-gray-400">
            Jua ni mtandao gani una gharama ndogo zaidi — M-Pesa, Tigo Pesa, Airtel Money, au HaloPesa.
          </p>
        </div>

        <form onSubmit={handleCompare} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTxnType('send')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                txnType === 'send' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-gray-700 text-gray-400'
              }`}
            >
              Kutuma
            </button>
            <button
              type="button"
              onClick={() => setTxnType('withdraw')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                txnType === 'withdraw' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-gray-700 text-gray-400'
              }`}
            >
              Kutoa Pesa
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Kiasi (TZS)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Linganisha
          </button>
        </form>

        {results && (
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Matokeo kwa {results.amount.toLocaleString()} TZS
            </p>
            {results.networks.map((n, i) => (
              <div
                key={n.network_id}
                className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                  i === 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-gray-800'
                }`}
              >
                <span className="text-sm font-medium text-white">
                  {n.network} {i === 0 && <span className="text-emerald-400 text-xs ml-1">(nafuu zaidi)</span>}
                </span>
                <span className="text-sm font-bold text-white">{n.fee.toLocaleString()} TZS</span>
              </div>
            ))}
            <div className="flex items-start gap-2 mt-3 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>Bei hizi ni makisio na zinaweza kubadilika. Thibitisha na mtoa huduma wako.</p>
            </div>
          </div>
        )}

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