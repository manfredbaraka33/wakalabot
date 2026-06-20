import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Coins, CheckCircle, XCircle, Clock, X, Check } from 'lucide-react'
import { getPaymentRequests, approvePayment, rejectPayment } from '../../api/superadmin'

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

function ActionModal({ request, action, onClose }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')

  const mut = useMutation({
    mutationFn: () => action === 'approve'
      ? approvePayment(request.id, note)
      : rejectPayment(request.id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-payments'] })
      onClose()
    },
  })

  const isApprove = action === 'approve'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="font-semibold text-white">
            {isApprove ? 'Approve Payment' : 'Reject Payment'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-800 rounded-xl p-4 space-y-1.5 text-sm">
            <p className="text-white font-semibold">{request.tenant_name}</p>
            <p className="text-gray-400">{request.tenant_email}</p>
            <p className="text-gray-300">Package: <span className="text-white capitalize">{request.package_id}</span></p>
            <p className="text-gray-300">Amount: <span className="text-yellow-400 font-semibold">{request.amount_tzs.toLocaleString()} TZS</span></p>
            <p className="text-gray-300">Coins: <span className="text-green-400 font-semibold">+{request.coins_requested}</span></p>
            <p className="text-gray-300">M-Pesa Ref: <span className="text-white font-mono">{request.mpesa_ref}</span></p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isApprove ? 'Payment verified' : 'Reason for rejection'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {mut.isError && <p className="text-red-400 text-sm">Action failed. Try again.</p>}

          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800">Cancel</button>
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-semibold disabled:opacity-50 transition-colors ${
                isApprove ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
              }`}
            >
              {isApprove ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {isApprove ? 'Approve & Credit Coins' : 'Reject Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminPayments() {
  const [filter, setFilter] = useState('pending')
  const [actionTarget, setActionTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sa-payments', filter],
    queryFn: () => getPaymentRequests({ status: filter || undefined }).then(r => r.data),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Coins className="w-6 h-6 text-yellow-400" />
          Payment Requests
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total} total requests</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', ''].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Business</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Package</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Coins</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">M-Pesa Ref</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No requests found.</td></tr>
            ) : (
              items.map(req => (
                <tr key={req.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{req.tenant_name}</p>
                    <p className="text-gray-500 text-xs">{req.tenant_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300 capitalize">{req.package_id}</td>
                  <td className="px-4 py-3 text-yellow-400 font-semibold">{req.amount_tzs.toLocaleString()} TZS</td>
                  <td className="px-4 py-3 text-green-400 font-semibold">+{req.coins_requested}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{req.mpesa_ref}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActionTarget({ ...req, action: 'approve' })}
                          className="rounded-lg p-1.5 text-green-400 hover:bg-green-400/10 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActionTarget({ ...req, action: 'reject' })}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {actionTarget && (
        <ActionModal
          request={actionTarget}
          action={actionTarget.action}
          onClose={() => setActionTarget(null)}
        />
      )}
    </div>
  )
}