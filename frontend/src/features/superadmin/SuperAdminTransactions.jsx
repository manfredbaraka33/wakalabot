import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Filter, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react'
import { getTransactions } from '../../api/superadmin'

const STATUS_OPTS = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

const STATUS_CFG = {
  success: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle },
  pending: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  failed: { color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

export default function SuperAdminTransactions() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const limit = 25

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sa-transactions', statusFilter, page],
    queryFn: () =>
      getTransactions({
        status: statusFilter || undefined,
        skip: page * limit,
        limit,
      }).then((r) => r.data),
    keepPreviousData: true,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-[#6366f1]" />
          Transactions
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total} total records</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />
        {STATUS_OPTS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(0) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              statusFilter === opt.value
                ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1]'
                : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm min-w-175">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Package</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount (TZS)</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Coins</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No transactions found.</td></tr>
            ) : items.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                  {new Date(t.created_at)?.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {t.tenant_id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 text-gray-300 capitalize">{t.package_id}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                  {t.amount_tzs?.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-amber-400 font-medium">
                  {t.coin_amount?.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{t.phone_number}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isFetching}
              className="rounded-lg border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
