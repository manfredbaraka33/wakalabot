import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Ticket, Filter, CheckCircle, Clock, AlertCircle, X, ChevronLeft, ChevronRight, MessageSquareReply,
} from 'lucide-react'
import { getTickets, updateTicket } from '../../api/superadmin'

const STATUS_OPTS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_CFG = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  in_progress: { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: AlertCircle },
  resolved: { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {status.replace('_', ' ')}
    </span>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default function SuperAdminTickets() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyForm, setReplyForm] = useState({ status: 'in_progress', admin_reply: '' })
  const limit = 25

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['sa-tickets', statusFilter, page],
    queryFn: () =>
      getTickets({ status: statusFilter || undefined, skip: page * limit, limit }).then((r) => r.data),
    keepPreviousData: true,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => updateTicket(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-tickets'] })
      qc.invalidateQueries({ queryKey: ['sa-stats'] })
      setReplyTarget(null)
    },
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

  function openReply(ticket) {
    setReplyTarget(ticket)
    setReplyForm({
      status: ticket.status === 'pending' ? 'in_progress' : ticket.status,
      admin_reply: ticket.admin_reply || '',
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Ticket className="w-6 h-6 text-[#6366f1]" />
          Support Tickets
        </h1>
        <p className="text-sm text-gray-400 mt-1">{total} total tickets</p>
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No tickets found.</td></tr>
            ) : items.map((t) => (
              <tr key={t.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-300 font-medium">{t.tenant_name}</td>
                <td className="px-4 py-3 text-white max-w-50 truncate">{t.subject}</td>
                <td className="px-4 py-3 text-gray-400 capitalize text-xs">
                  {t.category.replace('_', ' ')}
                </td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openReply(t)}
                    title="Reply / Update"
                    className="rounded-lg p-1.5 text-[#6366f1] hover:bg-[#6366f1]/10 transition-colors cursor-pointer"
                  >
                    <MessageSquareReply className="w-4 h-4" />
                  </button>
                </td>
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

      {/* Reply Modal */}
      {replyTarget && (
        <Modal title="Reply to Ticket" onClose={() => setReplyTarget(null)}>
          <div className="mb-4 rounded-lg bg-gray-800 border border-gray-700 p-3 space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {replyTarget.tenant_name} · {replyTarget.category.replace('_', ' ')}
            </p>
            <p className="text-sm font-medium text-white">{replyTarget.subject}</p>
            <p className="text-sm text-gray-400 line-clamp-3">{replyTarget.message}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Update Status</label>
              <select
                value={replyForm.status}
                onChange={(e) => setReplyForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Reply to User (optional)</label>
              <textarea
                value={replyForm.admin_reply}
                onChange={(e) => setReplyForm((p) => ({ ...p, admin_reply: e.target.value }))}
                rows={4}
                placeholder="Type your reply here…"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#6366f1] focus:outline-none resize-none"
              />
            </div>
          </div>

          {updateMut.isError && <p className="text-red-400 text-sm mt-3">Failed to update. Try again.</p>}

          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setReplyTarget(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={() =>
                updateMut.mutate({ id: replyTarget.id, payload: replyForm })
              }
              disabled={updateMut.isPending}
              className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#20bd5a] text-sm text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {updateMut.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
