import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Coins, Gift, Mail, Loader2, X, Check, Clock, CheckCircle, XCircle, ChevronDown,Plus,Zap } from 'lucide-react'
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

function TopUpModal({ onClose }) {
  const queryClient = useQueryClient()
  const [selectedPackage, setSelectedPackage] = useState(null)
  const [mpesaRef, setMpesaRef] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: packages = [] } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiClient.get('/api/v1/billing/packages').then(r => r.data),
  })

  const submitMut = useMutation({
    mutationFn: (data) => apiClient.post('/api/v1/billing/payment-request', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-requests'] })
      setSuccess(true)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!selectedPackage || !mpesaRef.trim()) return
    submitMut.mutate({ package_id: selectedPackage.id, mpesa_ref: mpesaRef.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="font-semibold text-white">Top Up Coins</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-400/10 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-white font-semibold">Request Submitted!</p>
            <p className="text-gray-400 text-sm">Your payment request has been sent to the admin. Coins will be credited after verification — usually within a few hours.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Package selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Select Package</label>
              <div className="grid grid-cols-2 gap-2">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackage(pkg)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      selectedPackage?.id === pkg.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <p className="text-white text-sm font-semibold">{pkg.label}</p>
                    <p className="text-yellow-400 text-xs mt-0.5">{pkg.coins} coins</p>
                    <p className="text-gray-400 text-xs">{pkg.amount_tzs.toLocaleString()} TZS</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Payment instructions */}
            {selectedPackage && (
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-white">Payment Instructions</p>
                <p className="text-sm text-gray-300">
                  Send <span className="text-yellow-400 font-semibold">{selectedPackage.amount_tzs.toLocaleString()} TZS</span> via M-Pesa to:
                </p>
                <p className="text-indigo-300 font-mono text-sm">0752303770 (MANFRED BARAKA JOSEPAHT)</p>
                <p className="text-xs text-gray-500">Then enter your M-Pesa transaction reference below.</p>
              </div>
            )}

            {/* M-Pesa ref */}
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
              <p className="text-red-400 text-sm">{submitMut.error?.response?.data?.detail || 'Failed to submit. Try again.'}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800">Cancel</button>
              <button
                type="submit"
                disabled={!selectedPackage || !mpesaRef.trim() || submitMut.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold disabled:opacity-50 transition-colors"
              >
                {submitMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
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
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
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
          <h3 className="font-semibold text-white">Chagua Mpango wa Kila Mwezi</h3>
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
              Ombi lako la mpango limetumwa kwa admin. Mpango utawashwa baada ya uthibitisho —
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
              <div className="space-y-2">
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
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-white font-bold">{plan.amount_tzs.toLocaleString()}</p>
                        <p className="text-gray-500 text-xs">TZS/mwezi</p>
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
                Cancel
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
  const [showTopUp, setShowTopUp] = useState(false)

  const [showSubscribe, setShowSubscribe] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiClient.get('/api/v1/billing/subscription').then(r => r.data),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiClient.get('/api/v1/billing/plans').then(r => r.data),
  })

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiClient.get('/api/v1/billing/wallet').then(r => r.data),
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => apiClient.get('/api/v1/billing/transactions').then(r => r.data),
  })

  const { data: paymentRequests = [] } = useQuery({
    queryKey: ['payment-requests'],
    queryFn: () => apiClient.get('/api/v1/billing/payment-requests').then(r => r.data),
  })

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Wallet</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your coin balance and top up your wallet.</p>
      </div>

        {/* Subscription status */}
        {subscription?.has_subscription ? (
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
            {/* Usage bar */}
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
                  ⚠️ Unatumia {subscription.usage_percent}% ya mzigo wako. Fikiria kuongeza coins za ziada.
                </p>
              )}
            </div>
            <button
              onClick={() => setShowSubscribe(true)}
              className="w-full py-2 rounded-lg border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 text-sm font-medium transition-colors"
            >
              Badilisha Mpango
            </button>
          </div>
        ) : (
          /* No subscription — show plans */
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Chagua Mpango</h2>
                <p className="text-xs text-gray-400">Lipa mara moja kwa mwezi. Bila wasiwasi wa coins.</p>
              </div>
            </div>
            <div className="space-y-3">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => { setSelectedPlan(plan); setShowSubscribe(true) }}
                  className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-indigo-500/50 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-sm">{plan.label}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{plan.description}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-white font-bold">{plan.amount_tzs.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">TZS/mwezi</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Coin balance — always visible as top-up option */}
        <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Coins za ziada</p>
            <p className="text-xl font-bold text-yellow-400">
              {wallet?.balance ?? 0}
              <span className="text-sm font-normal text-gray-400 ml-1">coins</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Zinatumika ukifikia kikomo cha mpango wako
            </p>
          </div>
          <button
            onClick={() => setShowTopUp(true)}
            className="flex items-center gap-1.5 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/20 px-3 py-2 text-yellow-400 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Top Up
          </button>
        </div>

      {/* Payment requests */}
      {paymentRequests.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Payment Requests</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden max-h-50 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 sticky top-0">Date</th>
                  <th className="text-left px-4 py-3 sticky top-0">Package</th>
                  <th className="text-right px-4 py-3 sticky top-0">Amount</th>
                  <th className="text-right px-4 py-3 sticky top-0">Coins</th>
                  <th className="text-left px-4 py-3 sticky top-0">Ref</th>
                  <th className="text-left px-4 py-3 sticky top-0">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {paymentRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(req.created_at)}</td>
                    <td className="px-4 py-3 text-gray-300 capitalize">{req.package_id}</td>
                    <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{req.amount_tzs.toLocaleString()} TZS</td>
                    <td className="px-4 py-3 text-right font-semibold text-yellow-400 tabular-nums">+{req.coins_requested}</td>
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
      )}

      {/* Transaction history */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-12 text-center">
            <Coins className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No transactions yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden max-h-50 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 sticky top-0">Date</th>
                  <th className="text-left px-4 py-3 sticky top-0">Type</th>
                  <th className="text-left px-4 py-3 sticky top-0">Note</th>
                  <th className="text-right px-4 py-3 sticky top-0">Coins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {transactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(txn.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        txn.tx_type === 'credit' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                      }`}>
                        {txn.tx_type === 'credit' ? 'Top-up' : 'AI Usage'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{txn.note ?? txn.package_id ?? '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      txn.coin_amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {txn.coin_amount > 0 ? '+' : ''}{txn.coin_amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
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