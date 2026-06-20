import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet, ChevronLeft, ChevronRight, Coins } from 'lucide-react'
import { getWallets } from '../../api/superadmin'

export default function SuperAdminWallets() {
  const [page, setPage] = useState(0)
  const limit = 25

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sa-wallets', page],
    queryFn: () => getWallets({ skip: page * limit, limit }).then((r) => r.data),
    keepPreviousData: true,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#6366f1]" />
          Wallets
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total} wallets</p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Business</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Wallet ID</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Balance (Coins)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No wallets found.</td></tr>
            ) : items.map((w) => (
              <tr key={w.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{w.tenant_name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{w.id.slice(0, 12)}…</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1.5 font-semibold ${w.balance > 0 ? 'text-amber-400' : 'text-gray-600'}`}>
                    <Coins className="w-3.5 h-3.5" />
                    {w.balance.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {new Date(w.last_updated).toLocaleString()}
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
