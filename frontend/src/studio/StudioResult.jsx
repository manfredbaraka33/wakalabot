import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Gift, Loader2, Palette, RotateCcw, Share2, Sparkles } from 'lucide-react'
import { downloadMedia, mediaUrl } from './studioApi'
import { useStudio } from './StudioContext'

const WIDTH = { story: 'max-w-xs', a4: 'max-w-sm', portrait: 'max-w-sm', square: 'max-w-md' }

export default function StudioResult({
  job, templates, palettes, filename = 'wakalabot.jpg', onTweak, onNew, newLabel = 'Tengeneza jipya',
  onRemoveWatermark, cleanCost, busy, error, needCredits,
}) {
  const url = mediaUrl(job.media_url)
  const tName = templates?.find((t) => t.id === job.template)?.name
  const pName = palettes?.find((p) => p.id === job.palette)?.name
  const { creator } = useStudio()
  const refLink = creator ? `${window.location.origin}/studio/signup?ref=${creator.referral_code}` : ''
  const inviteText = `Nimetengeneza tangazo la biashara yangu kwa Wakalabot Studio, bure kabisa. Jaribu na wewe (utapata credits 15 bure): ${refLink}`
  const [dlBusy, setDlBusy] = useState(false)
  const [dlError, setDlError] = useState('')

  async function download() {
    setDlError('')
    setDlBusy(true)
    try {
      await downloadMedia(job.media_url, filename)
    } catch {
      setDlError('Imeshindwa kupakua. Pakia upya ukurasa kisha ujaribu tena.')
    } finally {
      setDlBusy(false)
    }
  }

  async function share() {
    try {
      // const blob = await (await fetch(url)).blob()
      const blob = await (await fetch(url, { cache: 'no-store' })).blob()
      const file = new File([blob], filename, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return }
    } catch (e) {
      if (e?.name === 'AbortError') return
    }
    download()   // no share sheet on this device: download instead
  }

  return (
    <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-semibold text-emerald-400">Iko tayari!</p>
      <img src={url} alt="Matokeo" className={`w-full mx-auto rounded-xl ${WIDTH[job.fmt] || 'max-w-md'}`} />
      
      {(tName || pName) && <p className="text-center text-xs text-gray-500">Muundo: {tName || '—'} · Rangi: {pName || '—'}</p>}
      {job.bg_requested && job.bg_removed === false && (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Mandhari ya picha hii haikuweza kuondolewa, kwa hiyo tumetumia picha ya awali. Credits za kuondoa mandhari zimerudishwa.
        </p>
      )}

      {job.watermark && onRemoveWatermark && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-gray-300">Hii ina alama ndogo ya Wakalabot chini. Unaweza kuiondoa kwa credits {cleanCost}.</p>
          <button onClick={onRemoveWatermark} disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black px-4 py-2.5 text-sm font-semibold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Tengeneza bila alama (credits {cleanCost})
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          {needCredits && <Link to="/studio/app/credits" className="shrink-0 font-semibold text-amber-300 hover:underline">Nunua credits →</Link>}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={share} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold">
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button onClick={download} disabled={dlBusy}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 disabled:opacity-60 px-4 py-2.5 text-sm font-medium">
          {dlBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Pakua
        </button>
      </div>
      {dlError && <p className="text-xs text-red-400 text-center">{dlError}</p>}

            {creator && (
        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Gift className="w-4 h-4 text-fuchsia-300" /> Alika rafiki, pata credits 5
          </div>
          <p className="text-xs text-gray-400">
            Rafiki yako akitengeneza tangazo lake la kwanza, unapata credits 5 (hadi marafiki 10). Yeye anapata credits 15 bure.
          </p>
          <a href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-semibold">
            <Share2 className="w-4 h-4" /> Alika kwa WhatsApp
          </a>
        </div>
      )}

      <button onClick={onTweak} className="w-full flex items-center justify-center gap-2 rounded-lg border border-fuchsia-500/40 text-fuchsia-500 hover:bg-fuchsia-500/10 py-2.5 text-sm font-medium">
        <Palette className="w-4 h-4" /> Badilisha muundo, rangi au ukubwa
      </button>
      <button onClick={onNew} className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white">
        <RotateCcw className="w-4 h-4" /> {newLabel}
      </button>
    </div>
  )
}