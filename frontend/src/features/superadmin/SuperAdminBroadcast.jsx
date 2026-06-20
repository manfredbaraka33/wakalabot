import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Send, Loader2, CheckCircle, Users, User } from 'lucide-react'
import { getTenantsForBroadcast, sendBroadcast } from '../../api/superadmin'

export default function SuperAdminBroadcast() {
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState('all') // 'all' | 'select'
  const [selected, setSelected] = useState([])
  const [sent, setSent] = useState(null)

  
  const { data: tenants = [] } = useQuery({
  queryKey: ['sa-tenants-broadcast'],
  // Use the helper function
  queryFn: () => getTenantsForBroadcast().then(r => r.data.items || r.data),
})

const mut = useMutation({
  // Use the helper function
  mutationFn: () => sendBroadcast({
    message,
    tenant_ids: mode === 'select' ? selected : null,
  }),
  onSuccess: (res) => {
    setSent(res.data.sent_to)
    setMessage('')
    setSelected([])
    setTimeout(() => setSent(null), 4000)
  },
})

  function toggleTenant(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Send className="w-6 h-6 text-indigo-400" />
          Broadcast to Merchants
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Send a notification to selected merchants or all of them at once.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
        {/* Mode selector */}
        <div className="flex gap-3">
          <button
            onClick={() => setMode('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" />
            All Merchants ({tenants.length})
          </button>
          <button
            onClick={() => setMode('select')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'select' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            <User className="w-4 h-4" />
            Select Specific
          </button>
        </div>

        {/* Merchant selector */}
        {mode === 'select' && (
          <div className="max-h-48 overflow-y-auto bg-gray-800 rounded-xl divide-y divide-gray-700">
            {tenants.map(t => (
              <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  onChange={() => toggleTenant(t.id)}
                  className="accent-indigo-500"
                />
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{t.biz_name}</p>
                  <p className="text-gray-500 text-xs">{t.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder="e.g. Habari! WakalaBot imesasisha mfumo na kuongeza vipengele vipya. Tembelea dashibodi yako leo."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            maxLength={500}
          />
          <p className="text-xs text-gray-600 mt-1 text-right">{message.length}/500</p>
        </div>

        {sent !== null && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4" />
            Sent to {sent} merchant{sent !== 1 ? 's' : ''} successfully.
          </div>
        )}

        <button
          onClick={() => mut.mutate()}
          disabled={
            !message.trim() ||
            mut.isPending ||
            (mode === 'select' && selected.length === 0)
          }
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
        >
          {mut.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
            : <><Send className="w-4 h-4" /> Send Broadcast</>
          }
        </button>
      </div>
    </div>
  )
}