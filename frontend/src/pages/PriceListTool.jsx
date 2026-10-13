import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Loader2, Receipt, Plus, Trash2, ArrowRight } from 'lucide-react'
import apiClient from '../api/axios'
import WakalaLogo from '../components/Wakalalogo'
import ToolsNav from '../components/ToolsNav'

const THEMES = [
  { id: 'indigo', label: 'Indigo', color: '#6366f1' },
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
]

export default function PriceListTool() {
  const [businessName, setBusinessName] = useState('')
  const [items, setItems] = useState([{ name: '', price: '' }])
  const [theme, setTheme] = useState('indigo')
  const [imageUrl, setImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateItem(i, key, val) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item))
  }
  function addItem() {
    if (items.length >= 10) return
    setItems(prev => [...prev, { name: '', price: '' }])
  }
  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setImageUrl(null)
    try {
      const validItems = items.filter(it => it.name.trim() && it.price.trim())
      if (validItems.length === 0) {
        setError('Weka angalau bidhaa moja.')
        setLoading(false)
        return
      }
      const res = await apiClient.post(
        '/api/v1/tools/price-list-image',
        { business_name: businessName, items: validItems, theme },
        { responseType: 'blob' }
      )
      setImageUrl(URL.createObjectURL(res.data))
    } catch (err) {
      setError('Kuna tatizo. Tafadhali jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `orodha-ya-bei-${businessName || 'biashara'}.png`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToolsNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-8 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto">
            <Receipt className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tengeneza Orodha ya Bei</h1>
          <p className="text-sm text-gray-400">
            Weka bidhaa na bei zako, pata picha nzuri ya kushiriki WhatsApp Status — bure kabisa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Jina la Biashara</label>
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Juma Store"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bidhaa na Bei</label>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={item.name}
                  onChange={e => updateItem(i, 'name', e.target.value)}
                  placeholder="Jina la bidhaa"
                  className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  value={item.price}
                  onChange={e => updateItem(i, 'price', e.target.value)}
                  placeholder="Bei"
                  className="w-32 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 px-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {items.length < 10 && (
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ongeza bidhaa
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Rangi</label>
            <div className="flex gap-2">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    theme === t.id ? 'border-white/40' : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{ backgroundColor: theme === t.id ? `${t.color}20` : undefined, color: t.color }}
                >
                  {t.label}
                </button>
              ))}
            </div>
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
            {loading ? 'Inatengeneza…' : 'Tengeneza Picha'}
          </button>
        </form>

        {imageUrl && (
          <div className="mt-6 bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
            <img src={imageUrl} alt="Orodha ya Bei" className="w-full rounded-xl border border-gray-800" />
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <Download className="w-4 h-4" /> Pakua Picha
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