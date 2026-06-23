import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Copy, Check, Search } from 'lucide-react'
import { getTransactions } from '../../api/superadmin'

const TX_FILTERS = [
  { value: '', label: 'All' },
  { value: 'credit', label: '💰 Top-ups' },
  { value: 'deduction', label: '🤖 AI Usage' },
  { value: 'subscription_usage', label: '📋 Subscription Usage' },
]

const TX_BADGE = {
  credit: { label: 'Top-up', cls: 'bg-emerald-400/10 text-emerald-400' },
  deduction: { label: 'AI Usage', cls: 'bg-red-400/10 text-red-400' },
  subscription_usage: { label: 'Sub Usage', cls: 'bg-indigo-400/10 text-indigo-400' },
}

function TxBadge({ type }) {
  const cfg = TX_BADGE[type] || { label: type, cls: 'bg-gray-700 text-gray-400' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

function CopyId({ value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} title="Copy tenant ID"
      className="flex items-center gap-1 group text-gray-500 hover:text-gray-200 transition-colors cursor-pointer">
      <span className="font-mono text-xs">{value.slice(0, 8)}…</span>
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
    </button>
  )
}

function fmt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SuperAdminTransactions() {
  const [txType, setTxType] = useState('')
  const [tenantSearch, setTenantSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  const { data, isLoading } = useQuery({
    queryKey: ['sa-transactions', txType, tenantSearch, dateFrom, dateTo, page],
    queryFn: () =>
      getTransactions({
        tx_type: txType || undefined,
        tenant_id_search: tenantSearch.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        skip: page * limit,
        limit,
      }).then(r => r.data),
    keepPreviousData: true,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalAmount = data?.total_amount_tzs ?? 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-indigo-400" />
          Transactions
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total.toLocaleString()} records</p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Records (filtered)</p>
          <p className="text-2xl font-bold text-white mt-1">{total.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total TZS (filtered)</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {TX_FILTERS.map(f => (
            <button key={f.value} onClick={() => { setTxType(f.value); setPage(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                txType === f.value
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={tenantSearch}
              onChange={e => { setTenantSearch(e.target.value); setPage(0) }}
              placeholder="Search tenant UUID…"
              className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none w-56"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none" />
            <span className="text-gray-500 text-xs">to</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none" />
            {(dateFrom || dateTo || tenantSearch) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setTenantSearch(''); setPage(0) }}
                className="text-xs text-gray-500 hover:text-white underline cursor-pointer">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table with fixed height vertical scroll */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Note</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">TZS</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Coins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transactions found.</td></tr>
                ) : items.map(t => (
                  <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{fmtDate(t.created_at)}</td>
                    <td className="px-4 py-3"><CopyId value={t.tenant_id} /></td>
                    <td className="px-4 py-3"><TxBadge type={t.tx_type} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{t.note ?? t.package_id ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium tabular-nums">
                      {t.amount_tzs != null ? fmt(t.amount_tzs) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${t.coin_amount > 0 ? 'text-emerald-400' : t.coin_amount < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                      {t.coin_amount !== 0 ? (t.coin_amount > 0 ? '+' : '') + fmt(t.coin_amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800 disabled:opacity-40 cursor-pointer">
              ← Prev
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800 disabled:opacity-40 cursor-pointer">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}