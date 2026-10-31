import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Clapperboard, Download, ImagePlus, Loader2, Music, Share2, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import TemplatePicker from './TemplatePicker'
import useStudioJob from './useStudioJob'
import { compressImage } from '../utils/toolApi'
import { useStudio } from './StudioContext'
import { downloadMedia, errText, mediaUrl, studioApi } from './studioApi'

const inputCls = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
const LIMITS = { product: 60, price: 20, biz: 40, phone: 20, offer: 22 }
const MAX_PHOTOS = 3
const card = 'bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4'

function LimitInput({ value, onChange, max, ...rest }) {
  return (
    <div>
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max))} maxLength={max} className={inputCls} {...rest} />
      {value.length >= max * 0.8 && <p className={`text-[10px] text-right mt-0.5 ${value.length >= max ? 'text-red-400' : 'text-amber-400'}`}>{value.length}/{max}</p>}
    </div>
  )
}

function Choice({ on, onClick, title, hint, icon: Icon, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`text-left rounded-xl border p-3 transition-colors ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'} ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${on ? 'text-indigo-300' : 'text-gray-500'}`} />}
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      {hint && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{hint}</p>}
    </button>
  )
}

function VideoResult({ job, onNew }) {
  const [src, setSrc] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let url
    let dead = false
    fetch(mediaUrl(job.media_url), { cache: 'no-store' }).then((r) => r.blob()).then((b) => {
      if (dead) return
      url = URL.createObjectURL(b)
      setSrc(url)
    }).catch(() => {})
    return () => { dead = true; if (url) URL.revokeObjectURL(url) }
  }, [job.media_url])

  async function share() {
    setBusy(true)
    try {
      const blob = await (await fetch(mediaUrl(job.media_url), { cache: 'no-store' })).blob()
      const file = new File([blob], 'video-wakalabot.mp4', { type: 'video/mp4' })
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return }
    } catch (e) {
      if (e?.name === 'AbortError') return
    } finally { setBusy(false) }
    downloadMedia(job.media_url, 'video-wakalabot.mp4')
  }

  return (
    <div className="max-w-sm mx-auto bg-gray-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-semibold text-emerald-400">Video yako iko tayari!</p>
      {src ? <video src={src} controls playsInline loop className="w-full rounded-xl bg-black aspect-[9/16]" />
        : <div className="aspect-[9/16] rounded-xl bg-gray-950 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>}
      <div className="flex gap-2">
        <button onClick={share} disabled={busy} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold">
          <Share2 className="w-4 h-4" /> Tuma WhatsApp
        </button>
        <button onClick={() => downloadMedia(job.media_url, 'video-wakalabot.mp4')} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-4 py-2.5 text-sm font-medium">
          <Download className="w-4 h-4" /> Pakua
        </button>
      </div>
      <button onClick={onNew} className="w-full text-sm text-gray-400 hover:text-white">Tengeneza video nyingine</button>
    </div>
  )
}

export default function StudioVideo() {
  const { creator, refresh } = useStudio()
  const qc = useQueryClient()
  const { data: vc } = useQuery({ queryKey: ['studio-video-catalog'], queryFn: () => studioApi.videoCatalog().then((r) => r.data), refetchInterval: 60000 })
  const { data: catalog } = useQuery({ queryKey: ['studio-catalog'], queryFn: () => studioApi.catalog().then((r) => r.data) })

  const [kind, setKind] = useState('motion')
  const [photos, setPhotos] = useState([])
  const [style, setStyle] = useState('zoom')
  const [persona, setPersona] = useState('mama')
  const [audio, setAudio] = useState('silent')
  const [line, setLine] = useState('')
  const [product, setProduct] = useState('')
  const [price, setPrice] = useState('')
  const [offer, setOffer] = useState('')
  const [bizName, setBizName] = useState('')
  const [phone, setPhone] = useState('')
  const [template, setTemplate] = useState('kubwa')
  const [palette, setPalette] = useState('random')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [jobId, setJobId] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const job = useStudioJob(jobId)
  const inProgress = !!jobId && (!job || job.status === 'queued' || job.status === 'running')

  useEffect(() => {
    if (!creator) return
    setBizName((b) => b || creator.brand_name || '')
    setPhone((p) => p || creator.contact_phone || '')
  }, [creator])

  useEffect(() => {
    if (!inProgress) { setElapsed(0); return undefined }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [inProgress])

  useEffect(() => {
    if (job?.status === 'done' || job?.status === 'failed') {
      refresh()
      qc.invalidateQueries({ queryKey: ['studio-jobs'] })
      qc.invalidateQueries({ queryKey: ['studio-video-catalog'] })
    }
  }, [job?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickKind(k) {
    setKind(k)
    if (k === 'persona') { setPhotos((p) => p.slice(0, 1)); if (audio === 'music') setAudio('voice') }
  }

  async function onPick(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    const room = (kind === 'persona' || !vc?.extra_photos ? 1 : MAX_PHOTOS) - photos.length
    if (!files.length || room <= 0) return
    const added = []
    for (const f of files.slice(0, room)) {
      if (!f.type.startsWith('image/')) { setError('Chagua picha (JPG au PNG).'); continue }
      const c = await compressImage(f, 1600, 0.86)
      added.push({ file: c, url: URL.createObjectURL(c) })
    }
    if (added.length) { setPhotos((p) => [...p, ...added]); setError('') }
  }

  const P = vc?.prices || {}
  const n = photos.length
  const base = kind === 'persona' ? P.persona : P.motion
  const cost = (base || 0) + (kind === 'motion' ? Math.max(0, n - 1) * (P.extra_photo || 0) : 0)
    + (kind === 'motion' && audio === 'voice' ? (P.voiceover || 0) : 0)
  const words = line.trim() ? line.trim().split(/\s+/).length : 0
  const maxWords = vc?.max_words || 22
  const maxPhotos = kind === 'persona' || !vc?.extra_photos ? 1 : MAX_PHOTOS

  const audioOptions = kind === 'persona'
    ? [{ id: 'voice', name: 'Anaongea', hint: 'Mtu anasema maneno uliyoandika', icon: Volume2 },
       { id: 'silent', name: 'Kimya', hint: 'Bila sauti', icon: VolumeX }]
    : [{ id: 'silent', name: 'Kimya', hint: 'Bila sauti. Weka muziki ndani ya Instagram au TikTok', icon: VolumeX },
       { id: 'music', name: 'Muziki', hint: 'Muziki mwepesi wa nyuma', icon: Music },
       ...(vc?.voiceover_available ? [{ id: 'voice', name: 'Sauti ya maelezo', hint: 'Sauti inasoma maneno uliyoandika', icon: Volume2 }] : [])]

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!bizName.trim() || !product.trim() || !price.trim()) return setError('Weka jina la biashara, bidhaa na bei.')
    if (!n) return setError('Pakia picha ya bidhaa.')
    if (audio === 'voice' && (words < 3 || words > maxWords)) return setError(`Andika maneno ya kusemwa (maneno 3 hadi ${maxWords}).`)
    if (cost > (creator?.credits ?? 0)) return setError(`Unahitaji credits ${cost}, una ${creator?.credits ?? 0}.`)
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('style', style)
      fd.append('persona', persona)
      fd.append('audio', audio)
      fd.append('line', audio === 'voice' ? line.trim() : '')
      fd.append('product_name', product.trim())
      fd.append('price', price.trim())
      fd.append('offer', offer.trim())
      fd.append('business_name', bizName.trim())
      fd.append('phone', phone.trim())
      fd.append('template', template)
      fd.append('palette', palette)
      fd.append('photo', photos[0].file)
      if (photos[1]) fd.append('photo2', photos[1].file)
      if (photos[2]) fd.append('photo3', photos[2].file)
      const { data } = await studioApi.createVideo(fd)
      setJobId(data.id)
      refresh()
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!vc) return <div className="flex justify-center py-20 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>

  if (!vc.available) {
    return (
      <div className="max-w-lg mx-auto text-center bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-3">
        <Clapperboard className="w-10 h-10 text-fuchsia-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Video za matangazo — zinakuja!</h1>
        <p className="text-sm text-gray-400">Tunamalizia. Utapakia picha, kujaza fomu fupi, na kupata video tayari kwa WhatsApp Status, Instagram na TikTok.</p>
      </div>
    )
  }

  if (!inProgress && job?.status === 'done' && job.media_url) {
    return <VideoResult job={job} onNew={() => { setJobId(null); setPhotos([]); setLine('') }} />
  }
  if (inProgress) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const ss = String(elapsed % 60).padStart(2, '0')
    return (
      <div className="max-w-lg mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-fuchsia-400 mx-auto" />
        <p className="font-semibold text-white">Video yako inatengenezwa…</p>
        <p className="text-2xl font-mono text-gray-300">{mm}:{ss}</p>
        <p className="text-sm text-gray-500">Kawaida dakika 2 hadi 5. Unaweza kuondoka: itakuwa kwenye <Link to="/studio/app/library" className="text-indigo-400 underline">Kazi Zangu</Link>.</p>
      </div>
    )
  }
  if (job?.status === 'failed') {
    return (
      <div className="max-w-lg mx-auto bg-gray-900 border border-red-500/30 rounded-2xl p-6 text-center space-y-4">
        <AlertCircle className="w-9 h-9 text-red-400 mx-auto" />
        <p className="text-sm text-gray-300">{job.error || 'Video imeshindwa.'} Credits zimerudishwa.</p>
        <button onClick={() => setJobId(null)} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold">Jaribu tena</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Tengeneza Video</h1>
        <p className="text-sm text-gray-400 mt-1">Video fupi ya wima, tayari kwa WhatsApp Status, Instagram na TikTok.</p>
      </div>

      {!vc.unlocked && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          Video zinafunguliwa baada ya kununua credits mara ya kwanza. <Link to="/studio/app/credits" className="underline font-semibold">Nunua credits →</Link>
        </div>
      )}

      <div className={card}>
        <p className="text-sm font-semibold text-white">1. Aina ya video</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {vc.motion && <Choice on={kind === 'motion'} onClick={() => pickKind('motion')} title="Motion ya bidhaa" hint={`Picha yako inapata mwendo. Picha 1 hadi 3. Kuanzia credits ${P.motion}`} />}
          {vc.persona && <Choice on={kind === 'persona'} onClick={() => pickKind('persona')} title="Mtu anaonyesha bidhaa" hint={`Mtu wa kubuni (AI) anashika bidhaa yako na kuongea. Credits ${P.persona}`} />}
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">2. Picha {maxPhotos > 1 ? `(hadi ${maxPhotos})` : ''}</p>
          <span className="text-[11px] text-gray-500">{n}/{maxPhotos}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((ph, i) => (
            <div key={ph.url} className="relative aspect-square rounded-xl overflow-hidden border border-gray-700 bg-gray-950">
              <img src={ph.url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, k) => k !== i))} aria-label="Ondoa"
                className="absolute right-1.5 top-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 flex items-center justify-center text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {n < maxPhotos && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-700 hover:border-indigo-500/50 cursor-pointer flex flex-col items-center justify-center gap-1 text-gray-500">
              <ImagePlus className="w-6 h-6" /><span className="text-[11px]">Ongeza picha</span>
              <input type="file" accept="image/*" multiple={maxPhotos > 1} onChange={onPick} className="hidden" />
            </label>
          )}
        </div>
        <p className="text-[11px] text-gray-600">Tumia picha safi ya bidhaa moja. Picha inatumwa kwa Google kutengeneza video.</p>
      </div>

      {kind === 'motion' ? (
        <div className={card}>
          <p className="text-sm font-semibold text-white">3. Mtindo wa mwendo</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {vc.styles.map((s) => <Choice key={s.id} on={style === s.id} onClick={() => setStyle(s.id)} title={s.name} hint={s.hint} />)}
          </div>
        </div>
      ) : (
        <div className={card}>
          <p className="text-sm font-semibold text-white">3. Chagua mtu</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {vc.personas.map((s) => <Choice key={s.id} on={persona === s.id} onClick={() => setPersona(s.id)} title={s.name} hint={s.hint} />)}
          </div>
          <p className="text-[11px] text-gray-600">Hawa ni watu wa kubuni waliotengenezwa na AI, si watu halisi.</p>
        </div>
      )}

      <div className={card}>
        <p className="text-sm font-semibold text-white">4. Sauti</p>
        <div className={`grid gap-2 ${audioOptions.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {audioOptions.map((a) => <Choice key={a.id} on={audio === a.id} onClick={() => setAudio(a.id)} title={a.name} hint={a.hint} icon={a.icon} />)}
        </div>
        {audio === 'voice' && (
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Maneno ya kusemwa</label>
            <textarea value={line} onChange={(e) => setLine(e.target.value.slice(0, 170))} rows={3}
              placeholder="e.g. Perfume mpya imefika. Harufu nzuri inayodumu siku nzima. Piga simu uagize leo." className={inputCls} />
            <p className={`text-[11px] mt-1 ${words > maxWords ? 'text-red-400' : 'text-gray-500'}`}>Maneno {words}/{maxWords}. Yanasemwa kama ulivyoandika.</p>
          </div>
        )}
      </div>

      <div className={card}>
        <p className="text-sm font-semibold text-white">5. Maelezo ya tangazo <span className="text-gray-500 font-normal">(yanaandikwa kwenye kadi ya mwisho)</span></p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="block text-sm text-gray-300 mb-1.5">Bidhaa</label><LimitInput value={product} onChange={setProduct} max={LIMITS.product} placeholder="e.g. Perfume ya Oud" /></div>
          <div><label className="block text-sm text-gray-300 mb-1.5">Bei</label><LimitInput value={price} onChange={setPrice} max={LIMITS.price} placeholder="25000" /></div>
          <div><label className="block text-sm text-gray-300 mb-1.5">Jina la Biashara</label><LimitInput value={bizName} onChange={setBizName} max={LIMITS.biz} placeholder="e.g. Amina Perfumes" /></div>
          <div><label className="block text-sm text-gray-300 mb-1.5">Simu <span className="text-gray-600">(si lazima)</span></label><LimitInput value={phone} onChange={setPhone} max={LIMITS.phone} placeholder="0712 345 678" /></div>
          <div className="sm:col-span-2"><label className="block text-sm text-gray-300 mb-1.5">Ofa <span className="text-gray-600">(si lazima)</span></label><LimitInput value={offer} onChange={setOffer} max={LIMITS.offer} placeholder="e.g. Punguzo 20%" /></div>
        </div>
      </div>

      <div className={card}>
        <p className="text-sm font-semibold text-white">6. Muundo wa kadi ya mwisho</p>
        <TemplatePicker templates={catalog?.templates} palettes={catalog?.palettes} template={template} palette={palette}
          fmt="story" onTemplate={setTemplate} onPalette={setPalette} paletteExtra={{ value: 'random', label: 'Nishangaza' }} />
      </div>

      {error && <div className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300">{error}</div>}

      <button type="submit" disabled={busy || !vc.unlocked || vc.left_today <= 0}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 px-4 py-3.5 font-semibold transition-colors">
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        {busy ? 'Inatuma…' : `Tengeneza video (credits ${cost})`}
      </button>
      <p className="text-[11px] text-gray-600 text-center">Credits zinarudishwa kiotomatiki video ikishindwa. Video zinafutwa baada ya siku 30. Bei na jina vinaandikwa na mfumo wetu, si AI.</p>
    </form>
  )
}