import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react'
import apiClient from '../../api/axios'

import { getSuperAdminFeedback } from '../../api/superadmin'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-TZ', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function SuperAdminFeedback() {
  const [filter, setFilter] = useState('')

const { data, isLoading } = useQuery({
  queryKey: ['sa-feedback', filter],
  queryFn: () => getSuperAdminFeedback(filter).then(r => r.data),
})
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const positiveCount = items.filter(i => i.rating === 'positive').length
  const negativeCount = items.filter(i => i.rating === 'negative').length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-400" />
          Customer Feedback
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total} total responses</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 flex items-center gap-3">
          <ThumbsUp className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Positive</p>
            <p className="text-xl font-bold text-white">{positiveCount}</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 flex items-center gap-3">
          <ThumbsDown className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Negative</p>
            <p className="text-xl font-bold text-white">{negativeCount}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'positive', label: '👍 Positive' },
          { value: 'negative', label: '👎 Negative' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Rating</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Message</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Business</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No feedback yet.</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  {item.rating === 'positive'
                    ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-400/10 text-emerald-400 rounded-full px-2 py-0.5 font-medium"><ThumbsUp className="w-3 h-3" /> Positive</span>
                    : <span className="inline-flex items-center gap-1 text-xs bg-red-400/10 text-red-400 rounded-full px-2 py-0.5 font-medium"><ThumbsDown className="w-3 h-3" /> Negative</span>
                  }
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-gray-300 text-xs line-clamp-2 leading-relaxed">
                    {item.message_content || '—'}
                  </p>
                  {item.comment && (
                    <p className="text-gray-500 text-xs mt-1 italic">"{item.comment}"</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{item.tenant_name}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.customer_phone}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}