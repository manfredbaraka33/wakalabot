import { useState } from 'react'
import { Sparkles, Loader2, ImagePlus } from 'lucide-react'
import ToolsNav from '../components/ToolsNav'
import StylePicker from '../components/StylePicker'
import ImageResult from '../components/ImageResult'
import ToolCta from '../components/ToolCta'
import { compressImage, postForImage, recall, remember } from '../utils/toolApi'

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function AdGenerator() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [productName, setProductName] = useState('')
  const [price, setPrice] = useState('')
  const [businessName, setBusinessName] = useState(() => recall('wk_tool_biz'))
  const [phone, setPhone] = useState(() => recall('wk_tool_phone'))
  const [headline, setHeadline] = useState('')
  const [offer, setOffer] = useState('')
  const [style, setStyle] = useState('giza')
  const [fmt, setFmt] = useState('square')
  const [resultUrl, setResultUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onPick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('Chagua picha (JPG au PNG).')
      return
    }
    setError('')
    const compressed = await compressImage(f)
    setFile(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Pakia picha ya bidhaa kwanza.')
      return
    }
    setLoading(true)
    setError('')
    try {
      remember('wk_tool_biz', businessName)
      remember('wk_tool_phone', phone)
      const fd = new FormData()
      fd.append('image', file)
      fd.append('product_name', productName)
      fd.append('price', price)
      fd.append('business_name', businessName)
      fd.append('phone', phone)
      fd.append('headline', headline)
      fd.append('offer', offer)
      fd.append('style', style)
      fd.append('fmt', fmt)
      setResultUrl(await postForImage('/api/v1/tools/product-ad', fd))
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
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/15 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-fuchsia-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tengeneza Tangazo la Bidhaa</h1>
          <p className="text-sm text-gray-400">
            Piga picha ya bidhaa yako, pata tangazo tayari la Instagram na WhatsApp Status. Bure.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <label className="block cursor-pointer">
            <div className={`rounded-xl border-2 border-dashed ${preview ? 'border-indigo-500/40' : 'border-gray-700 hover:border-indigo-500/50'} overflow-hidden transition-colors`}>
              {preview ? (
                <img src={preview} alt="" className="w-full max-h-64 object-contain bg-gray-950" />
              ) : (
                <div className="py-10 flex flex-col items-center gap-2 text-gray-500">
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-sm">Bonyeza kuchagua picha ya bidhaa</span>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" onChange={onPick} className="hidden" />
          </label>
          {preview && <p className="text-xs text-gray-500 -mt-3">Bonyeza picha kubadilisha.</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Bidhaa</label>
              <input value={productName} onChange={e => setProductName(e.target.value)} required maxLength={80}
                placeholder="e.g. Kitenge cha Ankara" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Bei</label>
              <input value={price} onChange={e => setPrice(e.target.value)} required maxLength={30}
                placeholder="25000 au 20,000-30,000" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Jina la Biashara</label>
              <input value={businessName} onChange={e => setBusinessName(e.target.value)} required maxLength={50}
                placeholder="e.g. Amina Fashion" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Simu <span className="text-gray-600">(si lazima)</span>
              </label>
              <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20}
                placeholder="0712 345 678" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Kichwa cha tangazo <span className="text-gray-600">(acha wazi, AI itaandika)</span>
            </label>
            <input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={70}
              placeholder="e.g. Vitenge vipya vimewasili!" className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Ofa <span className="text-gray-600">(si lazima)</span>
            </label>
            <input value={offer} onChange={e => setOffer(e.target.value)} maxLength={24}
              placeholder="e.g. Punguzo 20%" className={inputCls} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Muonekano</label>
            <StylePicker value={style} onChange={setStyle} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Ukubwa</label>
            <div className="flex gap-2">
              {[
                { id: 'square', label: 'Post ya Instagram' },
                { id: 'story', label: 'Story / Status' },
              ].map(o => (
                <button key={o.id} type="button" onClick={() => setFmt(o.id)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    fmt === o.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Inatengeneza…' : resultUrl ? 'Tengeneza Upya' : 'Tengeneza Tangazo'}
          </button>
          <p className="text-[11px] text-gray-600 text-center">
            Picha yako haihifadhiwi kwenye seva yetu — inachakatwa tu kisha inafutwa.
          </p>
        </form>

        {resultUrl && (
          <ImageResult url={resultUrl} filename="tangazo.jpg" maxWidth={fmt === 'story' ? 'max-w-xs' : 'max-w-md'} />
        )}
        <ToolCta />
      </main>
    </div>
  )
}