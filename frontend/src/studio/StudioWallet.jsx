import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Gift, Loader2 } from 'lucide-react'
import { useStudio } from './StudioContext'
import { errText, studioApi } from './studioApi'

const KIND = {
  signup_bonus: 'Zawadi ya kujisajili', purchase: 'Ununuzi wa credits', spend: 'Matumizi',
  refund: 'Marejesho', referral: 'Zawadi ya mwaliko', admin_grant: 'Zawadi kutoka Wakalabot', admin_deduct: 'Marekebisho',
}
const PAY_BADGE = {
  pending: ['Inasubiri uthibitisho', 'text-amber-300 bg-amber-500/10'],
  approved: ['Imekubaliwa', 'text-emerald-300 bg-emerald-500/10'],
  rejected: ['Imekataliwa', 'text-red-300 bg-red-500/10'],
}

export default function StudioWallet() {
  const { creator, refresh } = useStudio()
  const qc = useQueryClient()
  const { data: packsData } = useQuery({ queryKey: ['studio-packs'], queryFn: () => studioApi.packs().then((r) => r.data) })
  const { data: wallet } = useQuery({ queryKey: ['studio-wallet'], queryFn: () => studioApi.wallet().then((r) => r.data), refetchInterval: 15000 })
  const [packId, setPackId] = useState(null)
  const [ref, setRef] = useState('')
  const [msg, setMsg] = useState(null)
  const [copied, setCopied] = useState('')

  // When an admin approves a payment, the balance changes server-side; pick it up.
  useEffect(() => {
    if (wallet && creator && wallet.credits !== creator.credits) refresh()
  }, [wallet, creator, refresh])

  const pay = useMutation({
    mutationFn: () => studioApi.submitPayment(packId, ref.trim()),
    onSuccess: ({ data }) => {
      setMsg({ ok: true, text: data.message })
      setRef('')
      qc.invalidateQueries({ queryKey: ['studio-wallet'] })
    },
    onError: (err) => setMsg({ ok: false, text: errText(err) }),
  })

  const packs = packsData?.packs || []
  const pick = packs.find((p) => p.id === packId)
  const firstPurchase = wallet && !wallet.payments.some((p) => p.status === 'approved')
  const bonusPct = packsData?.first_purchase_bonus_pct || 0
  const payTo = packsData?.pay_to
  const refLink = creator ? `${window.location.origin}/studio/signup?ref=${creator.referral_code}` : ''

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1800)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-amber-500/15 to-gray-900 border border-amber-500/20 rounded-2xl p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-300/80">Salio lako</p>
        <p className="text-4xl font-extrabold text-white mt-1">{(wallet?.credits ?? creator?.credits ?? 0).toLocaleString()}</p>
        <p className="text-sm text-gray-400">credits</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Nunua credits</h2>
        <div className="grid grid-cols-3 gap-2">
          {packs.map((p) => (
            <button key={p.id} onClick={() => { setPackId(p.id); setMsg(null) }}
              className={`rounded-xl border p-3 text-center transition-colors ${packId === p.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 bg-gray-900 hover:border-gray-700'}`}>
              <p className="text-xs text-gray-400">{p.label}</p>
              <p className="text-xl font-bold text-white">{p.credits}</p>
              <p className="text-[11px] text-gray-500">credits</p>
              <p className="text-sm font-semibold text-amber-300 mt-1">TZS {p.price_tzs.toLocaleString()}</p>
              <p className="text-[10px] text-gray-600">≈ {Math.round(p.price_tzs / p.credits)}/credit</p>
            </button>
          ))}
        </div>
        {firstPurchase && bonusPct > 0 && (
          <p className="mt-2 text-xs text-emerald-400">Zawadi: ununuzi wako wa kwanza unapata credits {bonusPct}% za ziada.</p>
        )}
      </div>

      {pick && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Jinsi ya kulipa</p>
          {payTo?.number ? (
            <ol className="text-sm text-gray-300 space-y-2 list-decimal pl-5">
              <li>Tuma <span className="text-amber-300 font-semibold">TZS {pick.price_tzs.toLocaleString()}</span> kwa M-Pesa, Tigo Pesa au Airtel Money kwenda:
                <div className="mt-1 flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2">
                  <span className="font-mono text-indigo-300">{payTo.number}</span>
                  <span className="text-xs text-gray-500 truncate">{payTo.name}</span>
                  <button onClick={() => copy(payTo.number, 'num')} className="ml-auto text-gray-400 hover:text-white">
                    {copied === 'num' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </li>
              <li>Utapokea SMS ya muamala. Nakili <span className="font-semibold">namba ya muamala (reference)</span>.</li>
              <li>Iweke hapa chini kisha bonyeza Tuma.</li>
            </ol>
          ) : (
            <p className="text-sm text-amber-300">Namba ya malipo haijawekwa bado (STUDIO_PAY_NUMBER kwenye .env ya seva).</p>
          )}
          <div className="flex gap-2">
            <input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} maxLength={20} placeholder="Reference, mf. QK3X5Y7Z8A"
              className="flex-1 min-w-0 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => pay.mutate()} disabled={pay.isPending || ref.trim().length < 6}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 text-sm font-semibold flex items-center gap-2">
              {pay.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Tuma
            </button>
          </div>
          {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        </div>
      )}

      {wallet?.payments?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Malipo yako</h3>
          <div className="space-y-2">
            {wallet.payments.map((p) => {
              const [label, cls] = PAY_BADGE[p.status] || PAY_BADGE.pending
              return (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white">TZS {p.amount_tzs.toLocaleString()} · {p.credits + p.bonus_credits} credits</p>
                    <p className="text-[11px] text-gray-500 font-mono truncate">{p.reference}{p.admin_note ? ` · ${p.admin_note}` : ''}</p>
                  </div>
                  <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 shrink-0 ${cls}`}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {creator && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-white font-semibold text-sm"><Gift className="w-4 h-4 text-fuchsia-400" /> Alika rafiki, pata credits</div>
          <p className="text-xs text-gray-400">Rafiki yako akinunua credits kwa mara ya kwanza kupitia kiungo chako, unapata zawadi ya credits.</p>
          <div className="flex items-center gap-2 bg-gray-950 rounded-lg px-3 py-2">
            <span className="text-xs text-indigo-300 truncate">{refLink}</span>
            <button onClick={() => copy(refLink, 'ref')} className="ml-auto text-gray-400 hover:text-white shrink-0">
              {copied === 'ref' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {wallet?.ledger?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Historia ya credits</h3>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800 max-h-80 overflow-y-auto">
            {wallet.ledger.map((l, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-gray-300 truncate">{KIND[l.kind] || l.kind}{l.note ? ` · ${l.note}` : ''}</p>
                  <p className="text-[11px] text-gray-600">{new Date(l.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className={`font-semibold tabular-nums ${l.delta > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>{l.delta > 0 ? '+' : ''}{l.delta}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}