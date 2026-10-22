import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ImagePlus, Loader2, Plus, Receipt, Sparkles, Trash2 } from 'lucide-react'
import TemplatePicker, { SizePicker } from './TemplatePicker'
import StudioResult from './StudioResult'
import WatermarkChoice from './WatermarkChoice'
import useStudioJob from './useStudioJob'
import { compressImage } from '../utils/toolApi'
import { useStudio } from './StudioContext'
import { errText, studioApi } from './studioApi'

const inputCls = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
const LIMITS = { biz: 40, tagline: 50, title: 30, phone: 20, name: 50, price: 20 }
const MAX_ITEMS = 12

function LimitInput({ value, onChange, max, ...rest }) {
  return (
    <div>
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} maxLength={max} className={inputCls} {...rest} />
      {value.length >= max * 0.8 && (
        <p className={`text-[10px] text-right mt-0.5 ${value.length >= max ? 'text-red-400' : 'text-amber-400'}`}>{value.length}/{max}</p>
      )}
    </div>
  )
}

export default function StudioPriceList() {
  const { creator, refresh } = useStudio()
  const qc = useQueryClient()
  const { data: catalog } = useQuery({ queryKey: ['studio-catalog'], queryFn: () => studioApi.catalog().then((r) => r.data) })

  const [bizName, setBizName] = useState('')
  const [tagline, setTagline] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [items, setItems] = useState([{ name: '', price: '' }])
  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [fmt, setFmt] = useState('square')
  const [template, setTemplate] = useState('orodha')
  const [palette, setPalette] = useState('giza')
  const [useFree, setUseFree] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needCredits, setNeedCredits] = useState(false)
  const [jobId, setJobId] = useState(null)
  const job = useStudioJob(jobId)

  useEffect(() => {
    if (!creator) return
    setBizName((b) => b || creator.brand_name || '')
    setPhone((p) => p || creator.contact_phone || '')
  }, [creator])

  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'failed') {
      refresh()
      qc.invalidateQueries({ queryKey: ['studio-jobs'] })
      qc.invalidateQueries({ queryKey: ['studio-catalog'] })
    }
  }, [job?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Policy: free = small watermark, clean costs credits. If the admin turns the policy off, it is free and clean.
  const svc = catalog?.services?.find((s) => s.key === 'pricelist')
  const wmPolicy = catalog?.pricelist_watermark ?? true
  const freeLeft = catalog?.pricelist_free_left ?? 0
  const freeAvailable = wmPolicy && !!svc && svc.watermark_cost != null && freeLeft > 0
  const free = useFree && freeAvailable
  const cleanCost = wmPolicy ? svc?.cost ?? 1 : 0
  const inProgress = !!jobId && (!job || job.status === 'queued' || job.status === 'running')

  const updateItem = (i, key, val) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)))
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  async function onLogo(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Chagua picha (JPG au PNG).')
    const c = await compressImage(f, 600, 0.9)
    setLogo(c)
    setLogoPreview(URL.createObjectURL(c))
    setError('')
  }

  async function generate(forceClean = false) {
    setError('')
    setNeedCredits(false)
    const valid = items.map((it) => ({ name: it.name.trim(), price: it.price.trim() })).filter((it) => it.name && it.price)
    if (!bizName.trim()) return setError('Weka jina la biashara.')
    if (valid.length === 0) return setError('Weka angalau bidhaa moja yenye bei.')
    const freeNow = wmPolicy && !forceClean && free
    const costNow = wmPolicy ? (freeNow ? 0 : cleanCost) : 0
    if (costNow > (creator?.credits ?? 0)) {
      setNeedCredits(true)
      return setError(`Unahitaji credits ${costNow}, una ${creator?.credits ?? 0}.`)
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('mode', 'pricelist')
      fd.append('fmt', fmt)
      fd.append('template', template)
      fd.append('palette', palette)
      fd.append('watermark', String(freeNow))
      fd.append('business_name', bizName.trim())
      fd.append('tagline', tagline.trim())
      fd.append('title', title.trim())
      fd.append('phone', phone.trim())
      fd.append('items_json', JSON.stringify(valid))
      if (logo) fd.append('photo', logo)
      const { data } = await studioApi.createJob(fd)
      setJobId(data.id)
      refresh()
    } catch (err) {
      if (err.response?.status === 402) setNeedCredits(true)
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!inProgress && job?.status === 'done' && job.media_url) {
    return (
      <div className="max-w-lg mx-auto">
        <StudioResult job={job} templates={catalog?.pricelist_templates} palettes={catalog?.palettes}
          filename="orodha-ya-bei.jpg" onTweak={() => setJobId(null)}
          onNew={() => { setJobId(null); setItems([{ name: '', price: '' }]) }} newLabel="Orodha mpya"
          onRemoveWatermark={job.watermark ? () => generate(true) : null}
          cleanCost={cleanCost} busy={busy} error={error} needCredits={needCredits} />
      </div>
    )
  }
  if (inProgress) {
    return (
      <div className="max-w-lg mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto" />
        <p className="font-semibold text-white">Inatengeneza orodha yako…</p>
      </div>
    )
  }
  if (job?.status === 'failed') {
    return (
      <div className="max-w-lg mx-auto bg-gray-900 border border-red-500/30 rounded-2xl p-6 text-center space-y-4">
        <AlertCircle className="w-9 h-9 text-red-400 mx-auto" />
        <p className="text-sm text-gray-300">{job.error || 'Kazi imeshindwa.'}</p>
        <button onClick={() => setJobId(null)} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold">Jaribu tena</button>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); generate(false) }} className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Receipt className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Orodha ya Bei <span className="align-middle text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 rounded-full px-2 py-0.5 ml-1">Bure</span></h1>
          <p className="text-sm text-gray-400 mt-1">Weka bidhaa au huduma na bei (hadi {MAX_ITEMS}), chagua muundo na rangi.</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex gap-3 items-end">
          <label className="shrink-0 cursor-pointer">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 hover:border-indigo-500/60 overflow-hidden flex items-center justify-center bg-gray-800">
              {logoPreview ? <img src={logoPreview} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="w-5 h-5 text-gray-500" />}
            </div>
            <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
          </label>
          <div className="flex-1 min-w-0">
            <label className="block text-sm text-gray-300 mb-1.5">Jina la Biashara <span className="text-gray-600">(logo si lazima)</span></label>
            <LimitInput value={bizName} onChange={setBizName} max={LIMITS.biz} placeholder="e.g. Amina Fashion" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Kichwa cha orodha <span className="text-gray-600">(si lazima)</span></label>
            <LimitInput value={title} onChange={setTitle} max={LIMITS.title} placeholder="Orodha ya Bei" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Kauli mbiu <span className="text-gray-600">(si lazima)</span></label>
            <LimitInput value={tagline} onChange={setTagline} max={LIMITS.tagline} placeholder="Ubora kwa bei nafuu" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-300 mb-1.5">Simu <span className="text-gray-600">(si lazima)</span></label>
            <LimitInput value={phone} onChange={setPhone} max={LIMITS.phone} placeholder="0712 345 678" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Bidhaa / Huduma na Bei</label>
          {items.map((item, i) => (
            <div key={i}
              className="rounded-xl border border-gray-800 bg-gray-950/50 p-3 space-y-2
                         sm:space-y-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0
                         sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_2rem] sm:gap-2 sm:items-center">
              <div className="flex items-center justify-between sm:hidden">
                <span className="text-xs font-medium text-gray-500">Kipengee {i + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} aria-label="Futa" className="text-red-400 hover:text-red-300 p-1 -m-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value.slice(0, LIMITS.name))}
                placeholder="Jina (bidhaa au huduma)" maxLength={LIMITS.name} className={`w-full min-w-0 ${inputCls}`} />
              <input value={item.price} onChange={(e) => updateItem(i, 'price', e.target.value.slice(0, LIMITS.price))}
                placeholder="Bei (mf. 25,000)" maxLength={LIMITS.price} className={`w-full min-w-0 ${inputCls}`} />
              {items.length > 1 ? (
                <button type="button" onClick={() => removeItem(i)} aria-label="Futa"
                  className="hidden sm:flex items-center justify-center text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : <span className="hidden sm:block" />}
            </div>
          ))}
          {items.length < MAX_ITEMS && (
            <button type="button" onClick={() => setItems((p) => [...p, { name: '', price: '' }])}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
              <Plus className="w-3.5 h-3.5" /> Ongeza kipengee ({items.length}/{MAX_ITEMS})
            </button>
          )}
          <p className="text-[11px] text-gray-600">Bei inaweza kuwa ya mstari (20,000-30,000), au "Kuanzia 15,000", au "Ada 5,000".</p>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Ukubwa</label>
          <SizePicker value={fmt} onChange={setFmt} />
        </div>

        {wmPolicy && <WatermarkChoice free={free} onChange={setUseFree} freeLeft={freeLeft} cleanCost={cleanCost} noun="orodha" />}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <TemplatePicker kind="pricelist" templates={catalog?.pricelist_templates} palettes={catalog?.palettes}
          template={template} palette={palette} fmt={fmt} onTemplate={setTemplate} onPalette={setPalette}
          paletteExtra={{ value: 'random', label: 'Nishangaze' }} />
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          {needCredits && <Link to="/studio/app/credits" className="shrink-0 font-semibold text-amber-300 hover:underline">Nunua credits →</Link>}
        </div>
      )}

      <button type="submit" disabled={busy}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-3.5 font-semibold transition-colors">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        {busy ? 'Inatuma…' : !wmPolicy || free ? 'Tengeneza Orodha (bure)' : `Tengeneza Orodha (credits ${cleanCost})`}
      </button>
    </form>
  )
}