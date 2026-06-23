import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Trash2, X, CheckCircle, Clock, AlertTriangle, User } from 'lucide-react'
import { 
  getCustomers, 
  deleteCustomer, 
  getNumberClaims, 
  updateNumberClaim 
} from '../../api/superadmin'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ClaimBadge({ status }) {
  if (status === 'resolved') return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-400/10 text-green-400 rounded-full px-2 py-0.5">
      <CheckCircle className="w-3 h-3" /> Resolved
    </span>
  )
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 text-xs bg-red-400/10 text-red-400 rounded-full px-2 py-0.5">
      <X className="w-3 h-3" /> Rejected
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-yellow-400/10 text-yellow-400 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
}

export default function SuperAdminCustomers() {
  const [tab, setTab] = useState('customers')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [claimAction, setClaimAction] = useState(null)
  const [adminNote, setAdminNote] = useState('')
  const qc = useQueryClient()

  const { data: customers = [], isLoading: customersLoading } = useQuery({
  queryKey: ['sa-customers', search],
  // Use the helper function here
  queryFn: () => getCustomers({ search: search || undefined }).then(r => r.data),
  enabled: tab === 'customers',
})

const { data: claims = [], isLoading: claimsLoading } = useQuery({
  queryKey: ['sa-claims'],
  queryFn: () => getNumberClaims().then(r => r.data),
  enabled: tab === 'claims',
})

  const deleteMut = useMutation({
  mutationFn: (id) => deleteCustomer(id),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-customers'] }); setDeleteTarget(null) },
})

const claimMut = useMutation({
  mutationFn: ({ id, action }) => updateNumberClaim(id, action, adminNote),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-claims'] }); setClaimAction(null); setAdminNote('') },
})

  const pendingClaims = claims.filter(c => c.status === 'pending').length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-400" />
          Customer Management
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('customers')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'customers' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          Customers
        </button>
        <button
          onClick={() => setTab('claims')}
          className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'claims' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
        >
          Number Claims
          {pendingClaims > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
              {pendingClaims}
            </span>
          )}
        </button>
      </div>

      {/* Customers tab */}
      {tab === 'customers' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {customersLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                ) : customers.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No customers found.</td></tr>
                ) : customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Claims tab */}
      {tab === 'claims' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Claim Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Phone Claimed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Claimant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {claimsLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : claims.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No claims yet.</td></tr>
              ) : claims.map(claim => (
                <tr key={claim.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-white font-mono text-xs font-bold">{claim.claim_code}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{claim.phone}</td>
                  <td className="px-4 py-3 text-gray-300">{claim.claimant_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{claim.claimant_contact}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(claim.created_at)}</td>
                  <td className="px-4 py-3"><ClaimBadge status={claim.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {claim.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => { setClaimAction({ ...claim, action: 'resolve' }); setAdminNote('') }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => { setClaimAction({ ...claim, action: 'reject' }); setAdminNote('') }}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-medium transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Delete Customer</p>
                <p className="text-gray-400 text-xs">This cannot be undone.</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-sm">
              <p className="text-white font-medium">{deleteTarget.name}</p>
              <p className="text-gray-400 font-mono text-xs mt-0.5">{deleteTarget.phone}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">Cancel</button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim action modal */}
      {claimAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <p className="text-white font-semibold">
              {claimAction.action === 'resolve' ? '✅ Resolve Claim' : '❌ Reject Claim'}
            </p>
            <div className="bg-gray-800 rounded-lg p-3 text-xs space-y-1">
              <p className="text-gray-400">Code: <span className="text-white font-mono font-bold">{claimAction.claim_code}</span></p>
              <p className="text-gray-400">Phone: <span className="text-white font-mono">{claimAction.phone}</span></p>
              <p className="text-gray-400">Claimant: <span className="text-white">{claimAction.claimant_name}</span></p>
              <p className="text-gray-400">Contact: <span className="text-white">{claimAction.claimant_contact}</span></p>
            </div>
            {claimAction.action === 'resolve' && (
              <p className="text-xs text-yellow-400 bg-yellow-400/10 rounded-lg p-2">
                After resolving: manually delete the squatter account from Customers tab, then tell the real owner to register again.
              </p>
            )}
            <input
              type="text"
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Admin note (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setClaimAction(null)} className="flex-1 py-2 rounded-lg text-sm text-gray-400 border border-gray-700">Cancel</button>
              <button
                onClick={() => claimMut.mutate({ id: claimAction.id, action: claimAction.action })}
                disabled={claimMut.isPending}
                className={`flex-1 py-2 rounded-lg text-sm text-white font-semibold transition-colors disabled:opacity-50 ${claimAction.action === 'resolve' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}