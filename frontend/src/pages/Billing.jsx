import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Coins, Loader2, X, Check, Clock, CheckCircle, XCircle, Zap, AlertTriangle } from 'lucide-react'
import apiClient from '../api/axios'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-TZ', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-400/10 text-green-400">
      <CheckCircle className="w-3 h-3" /> Approved
    </span>
  )
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-400/10 text-red-400">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-400/10 text-yellow-400">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
}

function durationLabel(days) {
  if (days <= 1) return 'siku 1'
  if (days <= 7) return 'wiki 1'
  if (days <= 31) return 'mwezi 1'
  return `siku ${days}`
}

function SubscribeModal({ plans, initialPlan, onClose }) {
  const queryClient = useQueryClient()
  const [selectedPlan, setSelectedPlan] = useState(initialPlan || null)
  const [mpesaRef, setMpesaRef] = useState('')
  const [success, setSuccess] = useState(false)

  const submitMut = useMutation({
    mutationFn: (data) =>
      apiClient.post('/api/v1/billing/subscribe', null, {
        params: { plan_id: data.plan_id, mpesa_ref: data.mpesa_ref },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] })
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] })
      setSuccess(true)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedPlan || !mpesaRef.trim()) return
    submitMut.mutate({ plan_id: selectedPlan.id, mpesa_ref: mpesaRef.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="font-semibold text-white">Chagua Mpango</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-white font-semibold">Ombi Limetumwa!</p>
            <p className="text-gray-400 text-sm">
              Ombi lako limetumwa kwa admin. Mpango utawashwa baada ya uthibitisho —
              kawaida ndani ya masaa machache.
            </p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
              Sawa
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Chagua Mpango</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {plans.map(plan => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      selectedPlan?.id === plan.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-semibold">{plan.label}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{plan.description}</p>
                        <p className="text-gray-600 text-[10px] mt-1">
                          {durationLabel(plan.duration_days)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-white font-bold">{plan.amount_tzs.toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">TZS</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedPlan && (
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-white">Maelekezo ya Malipo</p>
                <p className="text-sm text-gray-300">
                  Tuma <span className="text-yellow-400 font-semibold">{selectedPlan.amount_tzs.toLocaleString()} TZS</span> kupitia M-Pesa kwenda:
                </p>
                <p className="text-indigo-300 font-mono text-sm">0752303770 (MANFRED BARAKA JOSEPAHT)</p>
                <p className="text-xs text-gray-500">Kisha weka namba ya muamala wa M-Pesa hapo chini.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">M-Pesa Transaction Reference</label>
              <input
                type="text"
                value={mpesaRef}
                onChange={e => setMpesaRef(e.target.value)}
                placeholder="e.g. QK3X5Y7Z8A"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {submitMut.isError && (
              <p className="text-red-400 text-sm">
                {submitMut.error?.response?.data?.detail || 'Imeshindwa kutuma. Jaribu tena.'}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800">
                Ghairi
              </button>
              <button
                type="submit"
                disabled={!selectedPlan || !mpesaRef.trim() || submitMut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold disabled:opacity-50 transition-colors"
              >
                {submitMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Tuma Ombi
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Billing() {
  const [showSubscribe, setShowSubscribe] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const { data: status } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: () => apiClient.get('/api/v1/billing/subscription-status').then(r => r.data),
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiClient.get('/api/v1/billing/subscription').then(r => r.data),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiClient.get('/api/v1/billing/plans').then(r => r.data),
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.get('/api/v1/billing/transactions').then(r => r.data),
  })

  const { data: paymentRequests = [] } = useQuery({
    queryKey: ['payment-requests'],
    queryFn: () => apiClient.get('/api/v1/billing/payment-requests').then(r => r.data),
  })

  const state = status?.state ?? 'no_plan'

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-sm text-gray-400 mt-1">Simamia mpango wako wa Wakalabot.</p>
      </div>

      {/* State-driven banner — this is the fix for the stale "active" bug */}
      {state === 'no_plan' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Huna mpango bado</p>
            <p className="text-gray-400 text-sm mt-0.5">Chagua mpango kuanza kutumia bot yako.</p>
          </div>
        </div>
      )}

      {state === 'expired' && (
        <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Mpango wako umeisha muda</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Mpango wa <span className="capitalize">{status.plan_id}</span> ulishaisha tarehe{' '}
              {new Date(status.expired_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long' })}.
              Bot yako haijibu wateja sasa hivi.
            </p>
          </div>
        </div>
      )}

      {state === 'exhausted' && (
        <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Mazungumzo ya mpango wako yamefika kikomo</p>
            <p className="text-gray-400 text-sm mt-0.5">
              Mpango wa <span className="capitalize">{status.plan_id}</span> unaisha tarehe{' '}
              {new Date(status.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long' })},
              lakini mazungumzo yote yametumika. Nunua mpango wa ziada kuendelea sasa.
            </p>
          </div>
        </div>
      )}

      {state === 'active' && subscription?.has_subscription && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-semibold capitalize">{subscription.plan_id} Plan</p>
                <p className="text-xs text-gray-400">
                  Inaisha: {new Date(subscription.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-lg">{subscription.messages_remaining.toLocaleString()}</p>
              <p className="text-xs text-gray-400">mazungumzo yaliyobaki</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{subscription.messages_used.toLocaleString()} yaliyotumika</span>
              <span>{subscription.messages_included.toLocaleString()} jumla</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  subscription.usage_percent > 90 ? 'bg-red-500' :
                  subscription.usage_percent > 70 ? 'bg-yellow-500' :
                  'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(subscription.usage_percent, 100)}%` }}
              />
            </div>
            {subscription.usage_percent > 80 && (
              <p className="text-xs text-yellow-400 mt-1.5">
                ⚠️ Unatumia {subscription.usage_percent}% ya mzigo wako.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Always-visible subscribe/renew action — this is the graceful renewal fix */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-white">
              {state === 'active' ? 'Badilisha au Ongeza Mpango' : 'Nunua Mpango'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Chagua kutoka mipango ya siku, wiki, mwezi, au miezi mitatu.
            </p>
          </div>
          <button
            onClick={() => { setSelectedPlan(null); setShowSubscribe(true) }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {state === 'active' ? 'Badilisha Mpango' : 'Chagua Mpango'}
          </button>
        </div>
      </div>

      {/* Payment requests */}
      {paymentRequests.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Historia ya Malipo</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="max-h-80 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900">
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 sticky top-0 bg-gray-900">Tarehe</th>
                    <th className="text-left px-4 py-3 sticky top-0 bg-gray-900">Mpango</th>
                    <th className="text-right px-4 py-3 sticky top-0 bg-gray-900">Kiasi</th>
                    <th className="text-left px-4 py-3 sticky top-0 bg-gray-900">Ref</th>
                    <th className="text-left px-4 py-3 sticky top-0 bg-gray-900">Hali</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paymentRequests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(req.created_at)}</td>
                      <td className="px-4 py-3 text-gray-300 capitalize">
                        {req.package_id.replace('sub_', '')}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{req.amount_tzs.toLocaleString()} TZS</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{req.mpesa_ref}</td>
                      <td className="px-4 py-3">
                        <div>
                          <StatusBadge status={req.status} />
                          {req.admin_note && (
                            <p className="text-xs text-gray-500 mt-0.5">{req.admin_note}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Usage history */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Historia ya Matumizi</h2>
        {transactions.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
            <Coins className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Bado hakuna matumizi.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="max-h-80 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900">
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 sticky top-0 bg-gray-900">Tarehe</th>
                    <th className="text-left px-4 py-3 sticky top-0 bg-gray-900">Maelezo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {transactions.map(txn => (
                    <tr key={txn.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(txn.created_at)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{txn.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showSubscribe && (
        <SubscribeModal
          plans={plans}
          initialPlan={selectedPlan}
          onClose={() => { setShowSubscribe(false); setSelectedPlan(null) }}
        />
      )}
    </div>
  )
}