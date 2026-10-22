import { Check, Heart } from 'lucide-react'

export default function WatermarkChoice({ free, onChange, freeLeft, cleanCost, noun = 'tangazo' }) {
  const out = freeLeft <= 0
  const card = (on, disabled) =>
    `w-full text-left rounded-xl border p-3 transition-colors ${
      on ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`
  return (
    <div className="space-y-2">
      <label className="block text-sm text-gray-300">Bure au bila alama?</label>
      <div className="grid sm:grid-cols-2 gap-2">
        <button type="button" disabled={out} onClick={() => onChange(true)} className={card(free && !out, out)}>
          <div className="flex items-center gap-2">
            {free && !out ? <Check className="w-4 h-4 text-emerald-400" /> : <Heart className="w-4 h-4 text-gray-500" />}
            <span className="text-sm font-semibold text-white">Bure</span>
            <span className="text-[10px] font-bold uppercase text-emerald-300 bg-emerald-500/15 rounded-full px-1.5 py-0.5">0 credits</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            {out ? 'Za bure za leo zimeisha. Rudi kesho.' : `Alama ndogo ya Wakalabot chini ya ${noun}. Zimebaki ${freeLeft} leo.`}
          </p>
        </button>
        <button type="button" onClick={() => onChange(false)} className={card(!free || out, false)}>
          <div className="flex items-center gap-2">
            {!free || out ? <Check className="w-4 h-4 text-emerald-400" /> : <span className="w-4 h-4" />}
            <span className="text-sm font-semibold text-white">Bila alama</span>
            <span className="text-[10px] font-bold uppercase text-amber-300 bg-amber-500/15 rounded-full px-1.5 py-0.5">{cleanCost} credits</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Safi kabisa, tayari kwa biashara yako.</p>
        </button>
      </div>
      <p className="text-[11px] text-gray-600">Ukichagua bure, unatusaidia kukua kwa kuacha alama ndogo. Asante.</p>
    </div>
  )
}