import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, Loader2, MessageSquareText, ArrowRight } from 'lucide-react'
import apiClient from '../api/axios'
import WakalaLogo from '../components/Wakalalogo'
import ToolsNav from '../components/ToolsNav'

export default function BroadcastTool() {
  const [form, setForm] = useState({ business_name: '', product_name: '', price: '', offer: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await apiClient.post('/api/v1/tools/broadcast-message', form)
      setResult(res.data.message)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Kuna tatizo. Tafadhali jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToolsNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-8 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto">
            <MessageSquareText className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tengeneza Ujumbe wa WhatsApp Broadcast</h1>
          <p className="text-sm text-gray-400">
            Weka taarifa za bidhaa yako, pata ujumbe mzuri tayari kutumwa — bure kabisa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Jina la Biashara</label>
            <input
              value={form.business_name}
              onChange={e => set('business_name', e.target.value)}
              placeholder="e.g. Amina Beauty Shop"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bidhaa</label>
            <input
              value={form.product_name}
              onChange={e => set('product_name', e.target.value)}
              placeholder="e.g. Cream ya ngozi"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bei</label>
            <input
              value={form.price}
              onChange={e => set('price', e.target.value)}
              placeholder="e.g. 15,000 TZS"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Ofa <span className="text-gray-600">(si lazima)</span>
            </label>
            <input
              value={form.offer}
              onChange={e => set('offer', e.target.value)}
              placeholder="e.g. Punguzo 20% leo tu"
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Inatengeneza…' : 'Tengeneza Ujumbe'}
          </button>
        </form>

        {result && (
          <div className="mt-6 bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Ujumbe Wako</p>
            <p className="text-white leading-relaxed whitespace-pre-line">{result}</p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              {copied ? <><Check className="w-4 h-4 text-emerald-400" /> Imenakiliwa!</> : <><Copy className="w-4 h-4" /> Nakili Ujumbe</>}
            </button>
          </div>
        )}

        <div className="mt-10 bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-gray-400">
            Hii ni moja tu ya zana za Wakalabot. Fungua akaunti bure na upate AI
            inayojibu wateja wako moja kwa moja, masaa 24 kwa siku.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Jisajili Bure <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}