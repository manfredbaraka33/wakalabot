import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Search, Trash2, KeyRound, Coins, X, ChevronLeft, ChevronRight,
  BadgeCheck, ShieldOff, Crown, Eye, Zap, Brain, Check, Copy,
} from 'lucide-react'
import {
  getTenants, deleteTenant, resetPassword, addCoins, toggleVerify,
  getTenantSubscription, setTenantPlan, getTenantDetails,
} from '../../api/superadmin'

const PLANS = [
  { id: 'none', label: 'No Plan (Coin only)', color: 'text-gray-400' },
  { id: 'starter', label: 'Starter — 500 msg/mo (Eco)', color: 'text-yellow-400' },
  { id: 'business', label: 'Business — 2,000 msg/mo (Eco)', color: 'text-indigo-400' },
  { id: 'pro', label: 'Pro — 6,000 msg/mo (Smart)', color: 'text-emerald-400' },
]

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 shrink-0">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider shrink-0 w-32">{label}</span>
      <span className={`text-sm text-white text-right overflow-x-auto ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function SuperAdminTenants() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const limit = 20

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [coinsTarget, setCoinsTarget] = useState(null)
  const [planTarget, setPlanTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)

  const [newPw, setNewPw] = useState('')
  const [coinsAmt, setCoinsAmt] = useState(100)
  const [selectedPlanId, setSelectedPlanId] = useState('none')

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sa-tenants', search, page],
    queryFn: () =>
      getTenants({ search: search || undefined, skip: page * limit, limit }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: currentSub, isLoading: subLoading } = useQuery({
    queryKey: ['sa-tenant-sub', planTarget?.id],
    queryFn: () => getTenantSubscription(planTarget.id).then(r => r.data),
    enabled: !!planTarget,
    onSuccess: (data) => setSelectedPlanId(data.has_subscription ? data.plan_id : 'none'),
  })

  const { data: tenantDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['sa-tenant-detail', detailTarget?.id],
    queryFn: () => getTenantDetails(detailTarget.id).then(r => r.data),
    enabled: !!detailTarget,
   
  })


  const deleteMut = useMutation({
    mutationFn: (id) => deleteTenant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-tenants'] }); setDeleteTarget(null) },
  })
  const resetPwMut = useMutation({
    mutationFn: ({ id, pw }) => resetPassword(id, pw),
    onSuccess: () => { setResetTarget(null); setNewPw('') },
  })
  const addCoinsMut = useMutation({
    mutationFn: ({ id, coins }) => addCoins(id, coins),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-tenants'] }); setCoinsTarget(null) },
  })
  const verifyMut = useMutation({
    mutationFn: (id) => toggleVerify(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-tenants'] }),
  })
  const setPlanMut = useMutation({
    mutationFn: ({ id, plan_id }) => setTenantPlan(id, plan_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-tenants'] })
      qc.invalidateQueries({ queryKey: ['sa-tenant-sub'] })
      setPlanTarget(null)
    },
  })

  const tenants = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  const d = tenantDetail

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-400" />
          Tenants
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total} registered businesses</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by name, username or email…"
          className="w-full rounded-lg bg-gray-800 border border-gray-700 pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Business</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Mode</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No tenants found.</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{t.biz_name}</span>
                    {t.is_verified && <BadgeCheck className="w-4 h-4 text-indigo-400 shrink-0" title="Verified" />}
                  </div>
                  <p className="text-xs text-indigo-300 font-mono mt-0.5">@{t.username ?? '—'}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{t.slug ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.ai_mode === 'smart' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {t.ai_mode === 'smart' ? '🧠 Smart' : '⚡ Eco'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setDetailTarget(t)} title="View Details"
                      className="rounded-lg p-1.5 text-sky-400 hover:bg-sky-400/10 transition-colors cursor-pointer">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setPlanTarget(t); setSelectedPlanId('none') }} title="Set Plan"
                      className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-400/10 transition-colors cursor-pointer">
                      <Crown className="w-4 h-4" />
                    </button>
                    <button onClick={() => verifyMut.mutate(t.id)} disabled={verifyMut.isPending}
                      title={t.is_verified ? 'Remove verification' : 'Verify business'}
                      className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                        t.is_verified ? 'text-indigo-400 hover:bg-indigo-400/10' : 'text-gray-500 hover:bg-gray-700'
                      }`}>
                      {t.is_verified ? <BadgeCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setCoinsTarget(t); setCoinsAmt(100) }} title="Add Coins"
                      className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer">
                      <Coins className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setResetTarget(t); setNewPw('') }} title="Reset Password"
                      className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-400/10 transition-colors cursor-pointer">
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} title="Delete Tenant"
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-40 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isFetching}
              className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-40 cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tenant Detail Modal */}
      {detailTarget && (
        <Modal title={`${detailTarget.biz_name} — Details`} onClose={() => setDetailTarget(null)} wide>
          {detailLoading ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading details…</p>
          ) : d ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Identity</p>
                <div className="bg-gray-800 rounded-xl px-4 divide-y divide-gray-700">
                  <DetailRow label="Business Name" value={d.biz_name} />
                  <DetailRow label="Username" value={`@${d.username}`} mono />
                  <DetailRow label="Email" value={d.email} />
                  <DetailRow label="Phone" value={d.phone} />
                  <DetailRow label="Slug" value={d.slug} mono />
                  <DetailRow label="Verified" value={d.is_verified ? '✅ Yes' : '❌ No'} />
                  <DetailRow label="AI Mode" value={d.ai_mode === 'smart' ? '🧠 Smart' : '⚡ Eco'} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Wallet</p>
                <div className="bg-gray-800 rounded-xl px-4 divide-y divide-gray-700">
                  <DetailRow label="Coin Balance" value={`${d.wallet.balance?.toLocaleString() ?? 0} coins`} />
                  <DetailRow label="Total Spent" value={`${d.stats.total_spent_tzs?.toLocaleString() ?? 0} TZS`} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Subscription</p>
                <div className="bg-gray-800 rounded-xl px-4 divide-y divide-gray-700">
                  {d.subscription.has_subscription ? (
                    <>
                      <DetailRow label="Plan" value={d.subscription.plan_id} />
                      <DetailRow label="Usage" value={`${d.subscription.messages_used} / ${d.subscription.messages_included} messages`} />
                      <DetailRow label="Expires" value={d.subscription.expires_at ? new Date(d.subscription.expires_at).toLocaleDateString() : '—'} />
                    </>
                  ) : (
                    <DetailRow label="Status" value="No active subscription" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Activity</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Conversations', value: d.stats.conversations },
                    { label: 'Leads', value: d.stats.leads },
                    { label: 'Products', value: d.stats.products },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-white">{s.value?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      {/* Set Plan Modal */}
      {planTarget && (
        <Modal title={`Set Plan — ${planTarget.biz_name}`} onClose={() => setPlanTarget(null)}>
          {subLoading ? (
            <p className="text-gray-400 text-sm text-center py-4">Loading current subscription…</p>
          ) : (
            <>
              {currentSub?.has_subscription && (
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2 mb-4">
                  <p className="text-xs text-indigo-300">
                    Current: <span className="font-semibold capitalize">{currentSub.plan_id}</span> —{' '}
                    {currentSub.messages_used}/{currentSub.messages_included} messages used. Expires {new Date(currentSub.expires_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              <p className="text-gray-400 text-sm mb-4">
                Select a plan for <span className="text-white font-medium">@{planTarget.username}</span>. Overwrites any existing subscription immediately.
              </p>
              <div className="space-y-2 mb-5">
                {PLANS.map(plan => (
                  <label key={plan.id} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    selectedPlanId === plan.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}>
                    <input type="radio" name="plan" value={plan.id} checked={selectedPlanId === plan.id}
                      onChange={() => setSelectedPlanId(plan.id)} className="accent-indigo-500" />
                    <span className={`text-sm font-medium ${plan.color}`}>{plan.label}</span>
                  </label>
                ))}
              </div>
              {setPlanMut.isError && (
                <p className="text-red-400 text-sm mb-3">{setPlanMut.error?.response?.data?.detail || 'Failed. Try again.'}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setPlanTarget(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 cursor-pointer">Cancel</button>
                <button onClick={() => setPlanMut.mutate({ id: planTarget.id, plan_id: selectedPlanId })}
                  disabled={setPlanMut.isPending}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm text-white font-semibold disabled:opacity-50 cursor-pointer">
                  {setPlanMut.isPending ? 'Setting…' : 'Apply Plan'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <Modal title="Delete Tenant" onClose={() => setDeleteTarget(null)}>
          <p className="text-gray-300 text-sm mb-4">
            Permanently delete <span className="font-semibold text-white">{deleteTarget.biz_name}</span>? This erases all their data.
          </p>
          {deleteMut.isError && <p className="text-red-400 text-sm mb-3">Failed to delete. Try again.</p>}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 cursor-pointer">Cancel</button>
            <button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm text-white disabled:opacity-50 cursor-pointer">
              {deleteMut.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <Modal title="Reset Password" onClose={() => setResetTarget(null)}>
          <p className="text-gray-400 text-sm mb-4">New password for <span className="font-medium text-white">@{resetTarget.username}</span></p>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="New password (min 8 chars)" minLength={8}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none mb-4" />
          {resetPwMut.isError && <p className="text-red-400 text-sm mb-3">Failed. Try again.</p>}
          {resetPwMut.isSuccess && <p className="text-emerald-400 text-sm mb-3">Password updated!</p>}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setResetTarget(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 cursor-pointer">Cancel</button>
            <button onClick={() => resetPwMut.mutate({ id: resetTarget.id, pw: newPw })}
              disabled={resetPwMut.isPending || newPw.length < 8}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white disabled:opacity-50 cursor-pointer">
              {resetPwMut.isPending ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </Modal>
      )}

      {/* Add Coins Modal */}
      {coinsTarget && (
        <Modal title="Add Coins" onClose={() => setCoinsTarget(null)}>
          <p className="text-gray-400 text-sm mb-4">Add coins to <span className="font-medium text-white">@{coinsTarget.username}</span>'s wallet</p>
          <input type="number" value={coinsAmt} onChange={e => setCoinsAmt(Number(e.target.value))} min={1} max={100000}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none mb-4" />
          {addCoinsMut.isError && <p className="text-red-400 text-sm mb-3">Failed. Try again.</p>}
          {addCoinsMut.isSuccess && <p className="text-emerald-400 text-sm mb-3">{coinsAmt} coins added!</p>}
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCoinsTarget(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 cursor-pointer">Cancel</button>
            <button onClick={() => addCoinsMut.mutate({ id: coinsTarget.id, coins: coinsAmt })}
              disabled={addCoinsMut.isPending || coinsAmt <= 0}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm text-white font-semibold disabled:opacity-50 cursor-pointer">
              {addCoinsMut.isPending ? 'Adding…' : `Add ${coinsAmt} Coins`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}