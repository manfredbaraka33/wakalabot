import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ticket, CheckCircle, Clock, AlertCircle, Send, ChevronDown } from 'lucide-react'
import { submitTicket, getMyTickets } from '../api/support'

const CATEGORIES = [
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'general', label: 'General Enquiry' },
]

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: AlertCircle },
  resolved: { label: 'Resolved', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

export default function Support() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ subject: '', category: 'general', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const { data: ticketsData, isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => getMyTickets().then((r) => r.data),
  })

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: () => submitTicket(form),
    onSuccess: () => {
      setSubmitted(true)
      setForm({ subject: '', category: 'general', message: '' })
      qc.invalidateQueries({ queryKey: ['my-tickets'] })
      setTimeout(() => setSubmitted(false), 4000)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) return
    mutate()
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Ticket className="w-6 h-6 text-[#6366f1]" />
          Contact Support
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Submit a ticket and our team will get back to you as soon as possible.
        </p>
      </div>

      {/* Submission form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl">
        <h2 className="text-lg font-semibold text-white mb-5">New Ticket</h2>

        {submitted && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Ticket submitted! We'll respond within 24 hours.
          </div>
        )}

        {isError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
            {error?.response?.data?.detail || 'Failed to submit ticket. Please try again.'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Brief description of the issue"
              maxLength={255}
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
            <div className="relative">
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full appearance-none rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Describe your issue or question in detail..."
              rows={5}
              minLength={10}
              maxLength={5000}
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1] resize-none"
            />
            <p className="text-xs text-gray-600 mt-1 text-right">{form.message.length}/5000</p>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-[#6366f1] hover:bg-[#20bd5a] disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isPending ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </form>
      </div>

      {/* Ticket history */}
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">My Tickets</h2>

        {isLoading ? (
          <div className="text-gray-500 text-sm">Loading tickets…</div>
        ) : !ticketsData?.length ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 px-6 py-10 text-center text-gray-500 text-sm">
            No tickets yet. Submit one above if you need help.
          </div>
        ) : (
          <div className="space-y-3">
            {ticketsData.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-white text-sm">{t.subject}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-gray-500 capitalize">{t.category.replace('_', ' ')} · {new Date(t.created_at).toLocaleDateString()}</p>
                {t.admin_reply && (
                  <div className="mt-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2">
                    <p className="text-xs font-semibold text-[#6366f1] mb-1">Support Reply</p>
                    <p className="text-sm text-gray-300">{t.admin_reply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
