import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Copy, Gift, Share2, Users } from 'lucide-react'
import { studioApi } from './studioApi'

function status(f, slotsLeft) {
  if (f.earned > 0) return [`Umepata +${f.earned}`, 'text-emerald-300 bg-emerald-500/10']
  if (f.made) {
    return slotsLeft > 0
      ? ['Zawadi inasubiri', 'text-amber-300 bg-amber-500/10']
      : ['Kikomo kimefikiwa', 'text-gray-400 bg-gray-500/10']
  }
  return ['Amejisajili, bado hajatengeneza', 'text-gray-400 bg-gray-500/10']
}

export default function ReferralPanel({ refLink }) {
  const { data } = useQuery({
    queryKey: ['studio-referrals'],
    queryFn: () => studioApi.referrals().then((r) => r.data),
    refetchInterval: 30000,
  })
  const [copied, setCopied] = useState(false)
  const text = `Nimetengeneza tangazo la biashara yangu kwa Wakalabot Studio, bure kabisa. Jaribu na wewe (utapata credits 15 bure): ${refLink}`
  const cap = data?.cap ?? 10
  const used = data?.rewarded ?? 0

  function copy() {
    navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold text-sm">
        <Gift className="w-4 h-4 text-fuchsia-400" /> Mialiko yangu
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Walioalikwa', value: data?.invited ?? 0 },
          { label: 'Walitengeneza', value: data?.active ?? 0 },
          { label: 'Credits ulizopata', value: data?.earned ?? 0, hot: true },
        ].map((s) => (
          <div key={s.label} className="bg-gray-950 rounded-xl py-3 px-1">
            <p className={`text-xl font-bold ${s.hot ? 'text-emerald-300' : 'text-white'}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-gray-500 mb-1">
          <span>Marafiki waliokupa zawadi</span>
          <span>{used} / {cap}</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-fuchsia-400 rounded-full transition-all" style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
        </div>
      </div>

      <ul className="text-xs text-gray-400 space-y-1 list-disc pl-4">
        <li>Rafiki akitengeneza tangazo au orodha yake ya kwanza kupitia kiungo chako, unapata <span className="text-white font-medium">credits {data?.reward_per_friend ?? 5}</span> (hadi marafiki {cap}).</li>
        <li>Akinunua credits kwa mara ya kwanza, unapata 10% ya credits alizonunua (angalau 5).</li>
        <li>Wewe huoni namba yake ya simu wala kazi zake. Anaonekana kwa jina la mtumiaji lililofichwa kwa sehemu.</li>
      </ul>

      <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2">
        <span className="text-xs text-indigo-300 truncate">{refLink}</span>
        <button onClick={copy} className="ml-auto text-gray-400 hover:text-white shrink-0" aria-label="Nakili kiungo">
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-sm font-semibold">
        <Share2 className="w-4 h-4" /> Alika kwa WhatsApp
      </a>

      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 mb-2"><Users className="w-3.5 h-3.5" /> Marafiki zako</p>
        {!data || data.friends.length === 0 ? (
          <p className="text-xs text-gray-600">Bado hujaalika mtu. Shiriki kiungo chako hapo juu.</p>
        ) : (
          <div className="bg-gray-950 border border-gray-800 rounded-xl divide-y divide-gray-800 max-h-72 overflow-y-auto">
            {data.friends.map((f, i) => {
              const [label, cls] = status(f, data.slots_left)
              return (
                <div key={i} className="px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-mono truncate">@{f.name}</p>
                    <p className="text-[11px] text-gray-600">
                      {f.joined ? new Date(f.joined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                      {f.bought ? ' · Amenunua' : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 shrink-0 ${cls}`}>{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}