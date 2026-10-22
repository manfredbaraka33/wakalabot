import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import { BASE_URL } from './studioApi'
import { SIZES, aspectOf } from './sizes'

const PREVIEW_PATH = { poster: 'template-preview', pricelist: 'pricelist-preview' }

export function PalettePicker({ palettes = [], value, onChange, extra }) {
  return (
    <div className="flex flex-wrap gap-2">
      {extra && (
        <button type="button" onClick={() => onChange(extra.value)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === extra.value ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
          <Shuffle className="w-3.5 h-3.5" /> {extra.label}
        </button>
      )}
      {palettes.map((p) => (
        <button key={p.id} type="button" onClick={() => onChange(p.id)} title={p.name}
          className={`flex items-center gap-2 rounded-full border pl-1.5 pr-3 py-1 text-xs transition-colors ${
            value === p.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
          <span className="w-5 h-5 rounded-full border border-white/20"
            style={{ background: `linear-gradient(135deg, ${p.from}, ${p.to})`, boxShadow: `inset 0 0 0 3px ${p.accent}` }} />
          {p.name}
        </button>
      ))}
    </div>
  )
}

export function SizePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {SIZES.map((s) => {
        const on = value === s.id
        const hh = Math.min(40, (26 * s.h) / s.w)   // little shape showing the real proportions
        const ww = (hh * s.w) / s.h
        return (
          <button key={s.id} type="button" onClick={() => onChange(s.id)}
            className={`rounded-xl border p-2.5 text-left transition-colors ${
              on ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'}`}>
            <div className="h-10 flex items-end mb-1.5">
              <div className={`rounded-[3px] border ${on ? 'border-indigo-300 bg-indigo-400/20' : 'border-gray-600 bg-gray-700/40'}`}
                style={{ width: ww, height: hh }} />
            </div>
            <p className="text-xs font-semibold text-white">{s.name}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{s.note}</p>
          </button>
        )
      })}
    </div>
  )
}

// One design preview. If the image can't load, show the design's name instead of a broken icon.
function PreviewTile({ src, name, aspect }) {
  const [state, setState] = useState('loading')   // loading | ok | failed
  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-800" style={{ aspectRatio: aspect }}>
      {state !== 'failed' && (
        <img src={src} alt={name} loading="lazy"
          onLoad={() => setState('ok')} onError={() => setState('failed')}
          className={`w-full h-full object-cover transition-opacity ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`} />
      )}
      {state === 'loading' && <div className="absolute inset-0 animate-pulse bg-gray-700/40" />}
      {state === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center p-2 text-center bg-gradient-to-br from-gray-700 to-gray-800">
          <span className="text-[11px] font-semibold text-gray-300 leading-tight">{name}</span>
        </div>
      )}
    </div>
  )
}

export default function TemplatePicker({
  templates = [], palettes = [], template, palette, fmt, onTemplate, onPalette, paletteExtra, kind = 'poster',
}) {
  const previewPalette = palettes.some((p) => p.id === palette) ? palette : palettes[0]?.id
  const aspect = aspectOf(fmt)
  const path = PREVIEW_PATH[kind] || PREVIEW_PATH.poster

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-300 mb-2">Rangi</p>
        <PalettePicker palettes={palettes} value={palette} onChange={onPalette} extra={paletteExtra} />
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm text-gray-300">Muundo</p>
          <p className="text-[11px] text-gray-600">
            {templates.length} {templates.length > 4 ? 'miundo · sogeza chini kuona zaidi' : 'miundo'}
          </p>
        </div>
        <div className="max-h-[26rem] overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            <button type="button" onClick={() => onTemplate('random')}
              className={`rounded-xl border p-1.5 transition-colors ${template === 'random' ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 hover:border-gray-700'}`}>
              <div className="rounded-lg bg-gradient-to-br from-fuchsia-600/30 to-indigo-600/30 flex items-center justify-center" style={{ aspectRatio: aspect }}>
                <Shuffle className="w-7 h-7 text-fuchsia-300" />
              </div>
              <p className="text-[11px] text-gray-300 mt-1 text-center">Nishangaze</p>
            </button>
            {templates.map((t) => {
              const src = `${BASE_URL}/api/v1/studio/${path}?template=${t.id}&palette=${previewPalette}&fmt=${fmt}`
              return (
                <button key={t.id} type="button" onClick={() => onTemplate(t.id)}
                  className={`rounded-xl border p-1.5 transition-colors ${template === t.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 hover:border-gray-700'}`}>
                  <PreviewTile key={src} src={src} name={t.name} aspect={aspect} />
                  <p className="text-[11px] text-gray-300 mt-1 text-center">{t.name}</p>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}