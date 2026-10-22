import { Link } from 'react-router-dom'
import { Download, Loader2, Palette, RotateCcw, Share2, Sparkles } from 'lucide-react'
import { mediaUrl } from './studioApi'

const WIDTH = { story: 'max-w-xs', a4: 'max-w-sm', portrait: 'max-w-sm', square: 'max-w-md' }

export default function StudioResult({
  job, templates, palettes, filename = 'wakalabot.jpg', onTweak, onNew, newLabel = 'Tengeneza jipya',
  onRemoveWatermark, cleanCost, busy, error, needCredits,
}) {
  const url = mediaUrl(job.media_url)
  const tName = templates?.find((t) => t.id === job.template)?.name
  const pName = palettes?.find((p) => p.id === job.palette)?.name

  async function share() {
    try {
      const blob = await (await fetch(url)).blob()
      const file = new File([blob], filename, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return }
    } catch (e) {
      if (e?.name === 'AbortError') return
    }
    window.open(mediaUrl(job.media_url, true), '_blank')
  }

  return (
    <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-semibold text-emerald-400">Iko tayari!</p>
      <img src={url} alt="Matokeo" className={`w-full mx-auto rounded-xl ${WIDTH[job.fmt] || 'max-w-md'}`} />
      {(tName || pName) && <p className="text-center text-xs text-gray-500">Muundo: {tName || '—'} · Rangi: {pName || '—'}</p>}

      {job.watermark && onRemoveWatermark && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-amber-200">Hii ina alama ndogo ya Wakalabot chini. Unaweza kuiondoa kwa credits {cleanCost}.</p>
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
          <Share2 className="w-4 h-4" /> Tuma WhatsApp
        </button>
        <a href={mediaUrl(job.media_url, true)} className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-4 py-2.5 text-sm font-medium">
          <Download className="w-4 h-4" /> Pakua
        </a>
      </div>
      <button onClick={onTweak} className="w-full flex items-center justify-center gap-2 rounded-lg border border-fuchsia-500/40 text-fuchsia-300 hover:bg-fuchsia-500/10 py-2.5 text-sm font-medium">
        <Palette className="w-4 h-4" /> Badilisha muundo, rangi au ukubwa
      </button>
      <button onClick={onNew} className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white">
        <RotateCcw className="w-4 h-4" /> {newLabel}
      </button>
    </div>
  )
}