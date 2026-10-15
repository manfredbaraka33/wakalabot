import { useState } from 'react'
import { Receipt, Loader2, Plus, Trash2, ImagePlus } from 'lucide-react'
import ToolsNav from '../components/ToolsNav'
import StylePicker from '../components/StylePicker'
import ImageResult from '../components/ImageResult'
import ToolCta from '../components/ToolCta'
import { compressImage, postForImage, recall, remember } from '../utils/toolApi'

const inputCls =
  'rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function PriceListTool() {
  const [businessName, setBusinessName] = useState(() => recall('wk_tool_biz'))
  const [tagline, setTagline] = useState('')
  const [phone, setPhone] = useState(() => recall('wk_tool_phone'))
  const [style, setStyle] = useState('giza')
  const [items, setItems] = useState([{ name: '', price: '' }])
  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateItem(i, key, val) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))
  }

  function removeItem(i) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  async function onLogo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const c = await compressImage(f, 600, 0.9)
    setLogo(c)
    setLogoPreview(URL.createObjectURL(c))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const valid = items
      .map(it => ({ name: it.name.trim(), price: it.price.trim() }))
      .filter(it => it.name && it.price)
    if (valid.length === 0) {
      setError('Weka angalau bidhaa moja yenye bei.')
      return
    }
    setLoading(true)
    setError('')
    try {
      remember('wk_tool_biz', businessName)
      remember('wk_tool_phone', phone)
      const fd = new FormData()
      fd.append('business_name', businessName)
      fd.append('items_json', JSON.stringify(valid))
      fd.append('tagline', tagline)
      fd.append('phone', phone)
      fd.append('style', style)
      if (logo) fd.append('logo', logo)
      setResultUrl(await postForImage('/api/v1/tools/price-list-image', fd))
    } catch (err) {
      setError(err.message)
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
            <Receipt className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tengeneza Orodha ya Bei</h1>
          <p className="text-sm text-gray-400">
            Picha nzuri ya bei zako, tayari kwa WhatsApp Status na Instagram. Bure.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div className="flex gap-3 items-end">
            <label className="shrink-0 cursor-pointer">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 hover:border-indigo-500/60 overflow-hidden flex items-center justify-center bg-gray-800">
                {logoPreview ? <img src={logoPreview} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-5 h-5 text-gray-500" />}
              </div>
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Jina la Biashara <span className="text-gray-600">(logo si lazima)</span>
              </label>
              <input value={businessName} onChange={e => setBusinessName(e.target.value)} required maxLength={50}
                placeholder="e.g. Juma Store" className={`w-full ${inputCls}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Kauli mbiu <span className="text-gray-600">(si lazima)</span>
              </label>
              <input value={tagline} onChange={e => setTagline(e.target.value)} maxLength={60}
                placeholder="e.g. Ubora kwa bei nafuu" className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Simu <span className="text-gray-600">(si lazima)</span>
              </label>
              <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20}
                placeholder="0712 345 678" className={`w-full ${inputCls}`} />
            </div>
          </div>

                    <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Bidhaa na Bei</label>

            {items.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-950/50 p-3 space-y-2
                           sm:space-y-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0
                           sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_2rem] sm:gap-2 sm:items-center"
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
                  maxLength={60}
                  className={`w-full min-w-0 ${inputCls}`}
                />
                <input
                  value={item.price}
                  onChange={e => updateItem(i, 'price', e.target.value)}
                  placeholder="Bei (mf. 25,000)"
                  maxLength={30}
                  className={`w-full min-w-0 ${inputCls}`}
                />

                {/* Desktop only: delete button (keeps the columns aligned) */}
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

            {items.length < 12 && (
              <button type="button" onClick={() => setItems(p => [...p, { name: '', price: '' }])}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
                <Plus className="w-3.5 h-3.5" /> Ongeza bidhaa ({items.length}/12)
              </button>
            )}
            <p className="text-[11px] text-gray-600">Unaweza kuandika bei ya mstari, mfano 20,000-30,000.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Muonekano</label>
            <StylePicker value={style} onChange={setStyle} />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Inatengeneza…' : resultUrl ? 'Tengeneza Upya' : 'Tengeneza Orodha'}
          </button>
        </form>

        {resultUrl && <ImageResult url={resultUrl} filename="orodha-ya-bei.jpg" maxWidth="max-w-md" />}
        <ToolCta />
      </main>
    </div>
  )
}