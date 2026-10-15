import { useState } from 'react'
import { Download, Loader2, FileText, Plus, Trash2, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import apiClient from '../api/axios'
import ToolsNav from '../components/ToolsNav'

const inputCls =
  'rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function ReceiptTool() {
  const [docType, setDocType] = useState('receipt')
  const [businessName, setBusinessName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState([{ name: '', quantity: 1, unit_price: '' }])
  const [imageUrl, setImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isInvoice = docType === 'invoice'

  function updateItem(i, key, val) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))
  }
  function addItem() {
    if (items.length >= 15) return
    setItems(prev => [...prev, { name: '', quantity: 1, unit_price: '' }])
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
      const validItems = items
        .filter(it => it.name.trim() && it.unit_price !== '')
        .map(it => ({
          name: it.name.trim(),
          quantity: Math.max(1, parseInt(it.quantity) || 1),
          unit_price: Math.max(0, parseInt(it.unit_price) || 0),
        }))
      if (validItems.length === 0) {
        setError('Weka angalau bidhaa moja.')
        return
      }
      const res = await apiClient.post(
        '/api/v1/tools/receipt-image',
        {
          doc_type: docType,
          business_name: businessName,
          customer_name: customerName,
          due_date: dueDate,
          items: validItems,
        },
        { responseType: 'blob' }
      )
      setImageUrl(URL.createObjectURL(res.data))
    } catch {
      setError('Kuna tatizo. Hakikisha una mtandao kisha jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `${isInvoice ? 'invoice' : 'risiti'}-${customerName || 'mteja'}.png`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <ToolsNav />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-8 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isInvoice ? 'Tengeneza Invoice' : 'Tengeneza Risiti'}
          </h1>
          <p className="text-sm text-gray-400">
            {isInvoice
              ? 'Mtumie mteja invoice ya kitaalamu kabla ya kulipa — bure.'
              : 'Toa risiti ya kitaalamu kwa mteja wako — bure kabisa.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex gap-2">
            {[
              { id: 'receipt', label: 'Risiti' },
              { id: 'invoice', label: 'Invoice' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDocType(t.id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  docType === t.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Jina la Biashara</label>
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g. Juma Electronics"
              required
              maxLength={60}
              className={`w-full ${inputCls} py-2.5`}
            />
          </div>

          <div className={isInvoice ? 'grid grid-cols-2 gap-3' : ''}>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Jina la Mteja <span className="text-gray-600">(si lazima)</span>
              </label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Amina"
                maxLength={60}
                className={`w-full ${inputCls} py-2.5`}
              />
            </div>
            {isInvoice && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Lipa kabla ya</label>
                <input
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  placeholder="e.g. 30/09/2026"
                  maxLength={20}
                  className={`w-full ${inputCls} py-2.5`}
                />
              </div>
            )}
          </div>

                    <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Bidhaa</label>

            {/* Desktop column headers */}
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_5rem_8rem_2rem] gap-2 text-[11px] text-gray-500 px-0.5">
              <span>Jina</span><span>Idadi</span><span>Bei ya kimoja (TZS)</span><span />
            </div>

            {items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-950/50 p-3 space-y-2
                           sm:space-y-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0
                           sm:grid sm:grid-cols-[minmax(0,1fr)_5rem_8rem_2rem] sm:gap-2 sm:items-center"
              >
                {/* Phone only: item label + delete */}
                <div className="flex items-center justify-between sm:hidden">
                  <span className="text-xs font-medium text-gray-500">Bidhaa {i + 1}</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} aria-label="Futa bidhaa"
                      className="text-red-400 hover:text-red-300 p-1 -m-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  value={item.name}
                  onChange={e => updateItem(i, 'name', e.target.value)}
                  placeholder="Jina la bidhaa"
                  maxLength={80}
                  className={`w-full min-w-0 ${inputCls}`}
                />

                {/* On phones: quantity + price sit side by side. On desktop: sm:contents
                    dissolves this wrapper so they become columns of the parent grid. */}
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <label className="block min-w-0">
                    <span className="block text-[11px] text-gray-500 mb-1 sm:hidden">Idadi</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      placeholder="1"
                      min="1"
                      max="9999"
                      className={`w-full min-w-0 ${inputCls}`}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="block text-[11px] text-gray-500 mb-1 sm:hidden">Bei ya kimoja (TZS)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={item.unit_price}
                      onChange={e => updateItem(i, 'unit_price', e.target.value)}
                      placeholder="Bei"
                      min="0"
                      max="1000000000"
                      className={`w-full min-w-0 ${inputCls}`}
                    />
                  </label>
                </div>

                {/* Desktop only: delete button */}
                {items.length > 1 ? (
                  <button type="button" onClick={() => removeItem(i)} aria-label="Futa bidhaa"
                    className="hidden sm:flex items-center justify-center text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            ))}

            {items.length < 15 && (
              <button type="button" onClick={addItem}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
                <Plus className="w-3.5 h-3.5" /> Ongeza bidhaa ({items.length}/15)
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isInvoice ? 'Tengeneza Invoice' : 'Tengeneza Risiti'}
          </button>
        </form>

        {imageUrl && (
          <div className="mt-6 bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
            <img src={imageUrl} alt="Risiti" className="w-full max-w-sm mx-auto rounded-xl" />
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
          <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors">
            Jisajili Bure <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}