import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flame, ThumbsDown, Clock, MessageSquare, ShoppingBag, User, X, Bot, CheckCircle, Copy, Check } from 'lucide-react'
import { getAllLeads, getConversationMessages } from '../api/conversations' 
// 1. IMPORT YOUR ZUSTAND STORE (Adjust this path to match your project structure)
import useTenantStore from '../store/useTenantStore'


import apiClient from '../api/axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'


function CopyableField({ label, value }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700/40 rounded-lg px-2.5 py-1">
      <span className="text-[10px] text-gray-500 uppercase font-semibold shrink-0">{label}:</span>
      <span className="text-[11px] text-gray-300 font-mono truncate">{value || '—'}</span>
      {value && (
        <button
          onClick={copy}
          title={`Copy ${label}`}
          className="ml-1 p-0.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors shrink-0"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </div>
  )
}



// --- 1. LEAD BADGE COMPONENT ---
function LeadBadge({ status }) {
  if (status === 'hot') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-400">
      <Flame className="w-3 h-3" /> Hot
    </span>
  )
  if (status === 'cold') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-800 text-gray-400">
      <ThumbsDown className="w-3 h-3" /> Cold
    </span>
  )
  if (status === 'resolved') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-400">
      <CheckCircle className="w-3 h-3" /> Resolved
    </span>
  )
  
  // This is now the true default if none of the above match
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-500/15 text-yellow-400">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
}

// --- 2. CHAT HISTORY MODAL COMPONENT ---
function ChatModal({ conversationId, customerPhone, onClose }) {
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => getConversationMessages(conversationId),
    enabled: !!conversationId,
    refetchInterval: 4000, 
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 w-full max-w-2xl h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/50 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-gray-300 mb-1.5">Live Conversation Thread</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <CopyableField label="ID" value={conversationId} />
                <CopyableField label="Phone" value={customerPhone} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-900/20">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">Fetching records...</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-xs text-gray-600 italic">No chat logs.</div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user' || msg.role === 'customer'
              return (
                <div key={msg.id} className={`flex gap-2.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-indigo-600/20 text-indigo-400' : 'bg-emerald-600/20 text-emerald-400'}`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`rounded-2xl px-4 py-2 text-sm ${isUser ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-800/80 text-gray-300 border border-gray-700/30 rounded-tl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.image_url && (
                      <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
                        <img src={msg.image_url} alt="Attachment" className="w-full h-auto object-cover max-h-48" />
                      </div>
                    )}
                    <span className="block text-[9px] opacity-40 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// --- 3. MAIN DASHBOARD PAGE ---
export default function LeadsPage({ onSelectConversation }) {
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [activeCustomerPhone, setActiveCustomerPhone] = useState(null)
  // 2. CONNECT DIRECTLY TO THE STORE TO GRAB THE ACTIVE TENANT ID
  const tenantId = useTenantStore((state) => state.tenantId)

  const { data: leads = [], isLoading, error } = useQuery({
    queryKey: ['global-leads', tenantId],
    queryFn: () => getAllLeads(),
    enabled: !!tenantId, // Stays safe and reactive. Will instantly fire as soon as Zustand rehydrates!
    refetchInterval: 10000, 
  })


  const qc = useQueryClient()
  const resolveMut = useMutation({
    mutationFn: (id) => apiClient.patch(`/api/v1/leads/${id}/status?status=resolved`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global-leads'] }),
  })
  function resolveLead(id) { resolveMut.mutate(id) }


  // Fallback diagnostic state if someone accesses this page without being logged in
  if (!tenantId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-gray-500 text-xs">
        Waiting for authenticated business session context...
      </div>
    )
  }

  const hotCount = leads.filter(l => l.status === 'hot').length
  const pendingCount = leads.filter(l => l.status === 'pending').length
  const resolvedCount = leads.filter(l => l.status === 'resolved').length


  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-gray-400">
      Loading sales dashboard...
    </div>
  )


  return (
    <div className="flex-1 min-h-0 bg-gray-900 text-white p-6 overflow-y-auto space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
          <strong>Network Error:</strong> {error.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lead Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track purchase intent and customer details across all active chat sessions.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <Flame className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Hot Deals</p>
              <p className="text-lg font-semibold text-white leading-none mt-0.5">{hotCount}</p>
            </div>
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Follow Ups</p>
              <p className="text-lg font-semibold text-white leading-none mt-0.5">{pendingCount}</p>
            </div>
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Resolved</p>
              <p className="text-lg font-semibold text-white leading-none mt-0.5">{resolvedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        {leads.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-gray-600" />
            <p>No customer purchase intents have been recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50 text-gray-400 font-medium text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Event Type</th>
                  <th className="px-6 py-3.5">Target Item</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-300">{lead.customer_name || 'Anonymous User'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{lead.customer_phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-300 capitalize">
                      {lead.event_type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 text-gray-400">
                      {lead.product_name ? (
                        <span className="text-white bg-gray-800/80 px-2 py-1 rounded-md text-xs border border-gray-700/40">
                          {lead.product_name}
                        </span>
                      ) : (
                        <span className="text-gray-600 italic text-xs">No product mapped</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <LeadBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setActiveConversationId(lead.conversation_id);
                          setActiveCustomerPhone(lead.customer_phone);
                          if (onSelectConversation) onSelectConversation(lead.conversation_id);
                        }}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> View Chat
                      </button>
                      {lead.status !== 'resolved' && (
                          <button
                            onClick={() => resolveLead(lead.id)}
                            className="inline-flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ml-2"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Resolve
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        {activeConversationId && (
          <ChatModal
            conversationId={activeConversationId}
            customerPhone={activeCustomerPhone}
            onClose={() => {
              setActiveConversationId(null)
              setActiveCustomerPhone(null)
            }}
          />
        )}
    </div>
  )
}