import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ImagePlus, Loader2, Sparkles } from 'lucide-react'
import TemplatePicker, { SizePicker } from './TemplatePicker'
import StudioResult from './StudioResult'
import WatermarkChoice from './WatermarkChoice'
import useStudioJob from './useStudioJob'
import { compressImage } from '../utils/toolApi'
import { useStudio } from './StudioContext'
import { errText, studioApi } from './studioApi'

const inputCls = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
// The server enforces the same limits. Long text also shrinks on the poster instead of being cut.
const LIMITS = { product: 60, price: 20, biz: 40, phone: 20, headline: 60, offer: 22 }

const TYPE_COPY = {
  product: { name: 'Bidhaa', ph: 'e.g. Kitenge cha Ankara', photo: 'Bonyeza kuchagua picha ya bidhaa', pricePh: '25000 au 20,000-30,000' },
  service: { name: 'Huduma', ph: 'e.g. Kusuka nywele, Kufua na kupiga pasi', photo: 'Bonyeza kuchagua picha ya kazi yako au eneo lako', pricePh: '15000 au 10,000-20,000' },
}
const withPrefix = (price, word) => `${word} ${price.replace(/^(kuanzia|ada)\s*/i, '')}`.slice(0, LIMITS.price)

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

export default function StudioCreate() {
  const { creator, refresh } = useStudio()
  const qc = useQueryClient()
  const { data: catalog } = useQuery({ queryKey: ['studio-catalog'], queryFn: () => studioApi.catalog().then((r) => r.data) })

  const [itemType, setItemType] = useState('product')
  const [fmt, setFmt] = useState('square')
  const [template, setTemplate] = useState('kadi')
  const [palette, setPalette] = useState('giza')
  const [pTouched, setPTouched] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [product, setProduct] = useState('')
  const [price, setPrice] = useState('')
  const [offer, setOffer] = useState('')
  const [headline, setHeadline] = useState('')
  const [bizName, setBizName] = useState('')
  const [phone, setPhone] = useState('')
  const [useFree, setUseFree] = useState(true)
  const [removeBg, setRemoveBg] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needCredits, setNeedCredits] = useState(false)
  const [jobId, setJobId] = useState(null)
  const job = useStudioJob(jobId)
  const copy = TYPE_COPY[itemType]

  useEffect(() => {
    if (!creator) return
    setBizName((b) => b || creator.brand_name || '')
    setPhone((p) => p || creator.contact_phone || '')
    if (!pTouched) setPalette(creator.default_style || 'giza')
  }, [creator]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'failed') {
      refresh()
      qc.invalidateQueries({ queryKey: ['studio-catalog'] })
      qc.invalidateQueries({ queryKey: ['studio-jobs'] })
    }
  }, [job?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const svc = catalog?.services?.find((s) => s.key === 'poster_template')
  const freeLeft = catalog?.free_left_today ?? 0
  const freeAvailable = (catalog?.free_daily ?? 0) > 0 && !!svc && svc.watermark_cost != null && freeLeft > 0
  const free = useFree && freeAvailable
  const cleanCost = svc?.cost ?? 0
  const bgSvc = catalog?.services?.find((s) => s.key === 'bg_remove')
  const bgOn = removeBg && !!bgSvc && itemType === 'product'
  const bgCost = bgOn ? bgSvc.cost : 0
  const cost = (free ? 0 : cleanCost) + bgCost
  const inProgress = !!jobId && (!job || job.status === 'queued' || job.status === 'running')

  async function onPick(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Chagua picha (JPG au PNG).')
    const c = await compressImage(f, 1600, 0.86)
    setPhoto(c)
    setPreview(URL.createObjectURL(c))
    setError('')
  }

  function resetAll() {
    setJobId(null); setPhoto(null); setPreview(null); setProduct(''); setPrice('')
    setOffer(''); setHeadline(''); setError(''); setNeedCredits(false)
  }

  async function generate(forceClean = false) {
    setError('')
    setNeedCredits(false)
    if (!bizName.trim()) return setError('Weka jina la biashara.')
    if (!photo) return setError(`Pakia picha ya ${copy.name.toLowerCase()}.`)
    if (!product.trim() || !price.trim()) return setError(`Weka jina la ${copy.name.toLowerCase()} na bei.`)
    const freeNow = !forceClean && free
    const costNow = (freeNow ? 0 : cleanCost) + bgCost
    if (costNow > (creator?.credits ?? 0)) {
      setNeedCredits(true)
      return setError(`Unahitaji credits ${costNow}, una ${creator?.credits ?? 0}.`)
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('mode', 'template')
      fd.append('item_type', itemType)
      fd.append('remove_bg', String(bgOn))
      fd.append('fmt', fmt)
      fd.append('template', template)
      fd.append('palette', palette)
      fd.append('watermark', String(freeNow))
      fd.append('product_name', product.trim())
      fd.append('price', price.trim())
      fd.append('offer', offer.trim())
      fd.append('headline', headline.trim())
      fd.append('business_name', bizName.trim())
      fd.append('phone', phone.trim())
      fd.append('photo', photo)
      const { data } = await studioApi.createJob(fd)
      setJobId(data.id)
      refresh()
      qc.invalidateQueries({ queryKey: ['studio-catalog'] })
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
        <StudioResult job={job} templates={catalog?.templates} palettes={catalog?.palettes}
          filename="tangazo.jpg" onTweak={() => setJobId(null)} onNew={resetAll} newLabel={`${copy.name} nyingine`}
          onRemoveWatermark={job.watermark ? () => generate(true) : null}
          cleanCost={cleanCost + bgCost} busy={busy} error={error} needCredits={needCredits} />
      </div>
    )
  }
  if (inProgress) {
    return (
      <div className="max-w-lg mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto" />
        <p className="font-semibold text-white">Inatengeneza tangazo lako…</p>
        <p className="text-sm text-gray-500">Kwa kawaida sekunde chache tu.</p>
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
      <div>
        <h1 className="text-2xl font-bold text-white">Tengeneza Tangazo</h1>
        <p className="text-sm text-gray-400 mt-1">Pakia picha, chagua muundo, rangi na ukubwa. Maneno marefu yanapungua ukubwa yenyewe ili yatoshe.</p>
        <Link to="/studio/app/price-list" className="inline-block mt-2 text-xs text-emerald-300 hover:underline">Unahitaji orodha ya bei? Ni bure →</Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TYPE_COPY).map(([id, t]) => (
            <button key={id} type="button" onClick={() => setItemType(id)}
              className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                itemType === id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {t.name}
            </button>
          ))}
        </div>

        <label className="block cursor-pointer">
          <div className={`rounded-xl border-2 border-dashed overflow-hidden transition-colors ${preview ? 'border-indigo-500/40' : 'border-gray-700 hover:border-indigo-500/50'}`}>
            {preview ? (
              <img src={preview} alt="" className="w-full max-h-56 object-contain bg-gray-950" />
            ) : (
              <div className="py-8 flex flex-col items-center gap-2 text-gray-500">
                <ImagePlus className="w-7 h-7" />
                <span className="text-sm text-center px-4">{copy.photo}</span>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" onChange={onPick} className="hidden" />
        </label>

                {bgSvc && itemType === 'product' && (
          <label className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-950 p-3 cursor-pointer">
            <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} className="mt-0.5 accent-indigo-500" />
            <div>
              <p className="text-sm text-white">
                Ondoa mandhari ya picha (remove background)
                <span className="ml-2 text-[10px] font-bold uppercase text-amber-300 bg-amber-500/15 rounded-full px-1.5 py-0.5">+{bgSvc.cost} credits</span>
              </p>
              <p className="text-xs text-gray-500">
                Bidhaa yako inawekwa kwenye mandhari safi ya rangi ulizochagua. Inafaa kwa picha ya bidhaa moja (chupa, viatu, simu, begi). Isipofanikiwa, tunakurudishia credits.
              </p>
            </div>
          </label>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">{copy.name}</label>
            <LimitInput value={product} onChange={setProduct} max={LIMITS.product} placeholder={copy.ph} />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Bei</label>
            <LimitInput value={price} onChange={setPrice} max={LIMITS.price} placeholder={copy.pricePh} />
            {itemType === 'service' && (
              <div className="flex gap-2 mt-1.5">
                {['Kuanzia', 'Ada'].map((w) => (
                  <button key={w} type="button" onClick={() => setPrice(withPrefix(price, w))}
                    className="text-[11px] text-gray-400 border border-gray-700 hover:border-indigo-500 rounded-full px-2.5 py-1">{w}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Jina la Biashara</label>
            <LimitInput value={bizName} onChange={setBizName} max={LIMITS.biz} placeholder="e.g. Amina Fashion" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Simu <span className="text-gray-600">(si lazima)</span></label>
            <LimitInput value={phone} onChange={setPhone} max={LIMITS.phone} placeholder="0712 345 678" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Ofa <span className="text-gray-600">(si lazima)</span></label>
            <LimitInput value={offer} onChange={setOffer} max={LIMITS.offer} placeholder="e.g. Punguzo 20%" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Kichwa <span className="text-gray-600">(si lazima)</span></label>
            <LimitInput value={headline} onChange={setHeadline} max={LIMITS.headline} placeholder="Tutaandika kwa ajili yako" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Ukubwa</label>
          <SizePicker value={fmt} onChange={setFmt} />
        </div>

        {(catalog?.free_daily ?? 0) > 0 && (
          <WatermarkChoice free={free} onChange={setUseFree} freeLeft={freeLeft} cleanCost={cleanCost} />
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <TemplatePicker
          templates={catalog?.templates} palettes={catalog?.palettes}
          template={template} palette={palette} fmt={fmt}
          onTemplate={setTemplate}
          onPalette={(p) => { setPalette(p); setPTouched(true) }}
          paletteExtra={{ value: 'random', label: 'Nishangaze' }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          {needCredits && <Link to="/studio/app/credits" className="shrink-0 font-semibold text-amber-300 hover:underline">Nunua credits →</Link>}
        </div>
      )}

      <button type="submit" disabled={busy || !svc}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3.5 font-semibold transition-colors">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        {busy ? 'Inatuma…' : cost === 0 ? 'Tengeneza (bure)' : `Tengeneza (credits ${cost})`}
      </button>
      <p className="text-[11px] text-gray-600 text-center">Picha zako hazihifadhiwi kwenye seva — zinachakatwa kisha zinafutwa. Kazi zako zinafutwa baada ya siku 30.</p>
    </form>
  )
}