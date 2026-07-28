import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Phone, RefreshCw, User, Bot, ChevronLeft, ChevronRight, Flame, ThumbsDown, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { getConversations, getConversation } from '../api/conversations'
import apiClient from '../api/axios'
import ReactMarkdown from 'react-markdown' 
import remarkGfm from 'remark-gfm'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Lead badge ────────────────────────────────────────────────────────────────

function LeadBadge({ status }) {
  if (status === 'hot') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-500/15 text-red-400">
      <Flame className="w-3 h-3" /> Hot
    </span>
  )
  if (status === 'cold') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-700 text-gray-400">
      <ThumbsDown className="w-3 h-3" /> Cold
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-yellow-500/15 text-yellow-400">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
}

// ── Conversation List Item ────────────────────────────────────────────────────

function ConvItem({ conv, isActive, onClick }) {
  const hasHotLead = conv.lead_status === 'hot'
  const lastSeen = localStorage.getItem(`wk_seen_${conv.id}`)
  const isUnread = conv.last_timestamp && (!lastSeen || new Date(conv.last_timestamp) > new Date(lastSeen))

  function handleClick() {
    localStorage.setItem(`wk_seen_${conv.id}`, new Date().toISOString())
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-800 hover:bg-gray-800/60 transition-colors ${
        isActive ? 'bg-gray-800' : ''
      }`}
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center relative">
        <User className="w-5 h-5 text-indigo-400" />
        {hasHotLead && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <Flame className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold truncate ${isUnread && !isActive ? 'text-white' : 'text-gray-300'}`}>
            {conv.customer_name || conv.customer_phone}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {conv.last_timestamp && (
              <span className="text-[11px] text-gray-500">{formatTime(conv.last_timestamp)}</span>
            )}
            {isUnread && !isActive && (
              <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
            )}
          </div>
        </div>
        <p className={`text-xs truncate mt-0.5 ${isUnread && !isActive ? 'text-gray-300' : 'text-gray-500'}`}>
          {conv.last_message_role === 'assistant' && (
            <span className="text-indigo-400 mr-1">Bot:</span>
          )}
          {conv.last_message || 'No messages yet'}
        </p>
      </div>
    </button>
  )
}

// ── Content parser ────────────────────────────────────────────────────────────

function optimiseCloudinary(url) {
  return url.includes('/upload/')
    ? url.replace('/upload/', '/upload/f_auto,q_auto/')
    : url
}

function parseContent(raw) {
  if (!raw) return { cleanText: '', embeddedUrls: [] }
  let text = raw.replace(/\bFORCE_IMAGE\b/gi, '').trim()

  const embeddedUrls = []

  // 1. Match and extract [IMAGE_URL: ...] tags and strip full brackets
  const tagRegex = /\[IMAGE_URL:\s*(https?:\/\/[^\]\s]+)\]/gi
  let match
  while ((match = tagRegex.exec(text)) !== null) {
    embeddedUrls.push(match[1])
  }
  text = text.replace(tagRegex, '')

  // 2. Extract remaining raw Cloudinary or standard image links
  const rawUrlRegex = /https?:\/\/(?:res\.cloudinary\.com\/[^\s\]"')]+|[^\s\]"')]+\.(?:png|jpg|jpeg|webp|gif))/gi
  while ((match = rawUrlRegex.exec(text)) !== null) {
    if (!embeddedUrls.includes(match[0])) {
      embeddedUrls.push(match[0])
    }
  }
  text = text.replace(rawUrlRegex, '')

  const cleanText = text.trim()
  return { cleanText, embeddedUrls }
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const { cleanText, embeddedUrls } = parseContent(msg.content || '')

  // Combine image sources: array fields, single image fields, and extracted text URLs
  const combinedImages = [
    ...(Array.isArray(msg.image_urls) ? msg.image_urls : []),
    ...(msg.image_url ? [msg.image_url] : []),
    ...embeddedUrls,
  ]

  // Remove duplicate URLs
  const allImages = [...new Set(combinedImages)]

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-2`}>
      <div className="flex items-end gap-2 max-w-[75%]">
        {isUser && (
          <div className="shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center mb-1">
            <User className="w-4 h-4 text-gray-300" />
          </div>
        )}
        <div className={`rounded-2xl px-3 py-2 text-sm shadow-sm flex flex-col ${
          isUser
            ? 'bg-gray-700 text-white rounded-tl-none'
            : 'bg-indigo-700 text-gray-50 rounded-tr-none' 
        }`}>
          

          {cleanText && (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ node, ...props }) => (
                  <a 
                    {...props} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium break-all"
                  />
                ),
                p: ({ node, ...props }) => (
                  <p {...props} className="whitespace-pre-wrap wrap-break-word" />
                )
              }}
            >
              {cleanText}
            </ReactMarkdown>
          )}


          {(msg.image_urls?.length > 0 || msg.image_url) && (
          <div className={`flex flex-wrap gap-2 mt-2`}>
            {(msg.image_urls?.length > 0
              ? msg.image_urls
              : [msg.image_url]
            ).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Picha ${i + 1}`}
                className="rounded-xl object-cover max-h-52 max-w-[220px] cursor-pointer hover:opacity-90 transition-opacity border border-gray-700"
                onClick={() => window.open(url, '_blank')}
                onError={e => { e.target.style.display = 'none' }}
              />
            ))}
          </div>
        )}
          <p className={`text-[10px] mt-1 text-right ${isUser ? 'text-gray-400' : 'text-indigo-200'}`}>
            {formatTime(msg.timestamp)}
          </p>
        </div>
        {!isUser && (
          <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center mb-1">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Leads Panel ───────────────────────────────────────────────────────────────

function LeadsPanel({ convId }) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', convId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/v1/conversations/${convId}/leads`)
      return res.data
    },
    enabled: !!convId,
  })

  if (isLoading) return (
    <div className="p-4 text-xs text-gray-500">Loading leads...</div>
  )
  if (leads.length === 0) return (
    <div className="p-4 text-xs text-gray-600">No lead events captured yet.</div>
  )

  return (
    <div className="p-4 space-y-3">
      {leads.map(lead => (
        <div key={lead.id} className="bg-gray-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white capitalize">
              {lead.event_type.replace('_', ' ')}
            </span>
            <LeadBadge status={lead.status} />
          </div>
          {lead.product_name && (
            <p className="text-xs text-gray-400">
              Product: <span className="text-white">{lead.product_name}</span>
            </p>
          )}
          {lead.customer_name && (
            <p className="text-xs text-gray-400">
              Name: <span className="text-white">{lead.customer_name}</span>
            </p>
          )}
          <p className="text-xs text-gray-500">{formatDate(lead.created_at)}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Conversations() {
  const [selectedId, setSelectedId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showLeads, setShowLeads] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  
  const bottomRef = useRef(null)
  const topRef = useRef(null)

  const {
    data: conversations = [],
    isLoading: listLoading,
    refetch: refetchList,
    isFetching: listFetching,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    refetchInterval: 10_000,
  })

  const {
    data: active,
    isLoading: chatLoading,
    refetch: refetchChat,
  } = useQuery({
    queryKey: ['conversation', selectedId],
    queryFn: () => getConversation(selectedId),
    enabled: !!selectedId,
    refetchInterval: 10_000,
  })

  useEffect(() => {
    if (bottomRef.current && !showScrollDown) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [active?.messages?.length])

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 150
    const isScrolledDown = scrollTop > 150
    
    setShowScrollDown(isScrolledUp)
    setShowScrollTop(isScrolledDown)
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleRefresh() {
    refetchList()
    if (selectedId) refetchChat()
  }

  return (
    <div className="flex h-screen w-full min-h-0 relative overflow-hidden">

      {/* ── Left pane ── */}
      <aside className={`flex flex-col border-r border-gray-800 bg-gray-950 min-h-0 transition-all duration-300 overflow-hidden ${
        sidebarOpen ? 'w-80 shrink-0' : 'w-0'
      }`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Conversations</h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleRefresh} title="Refresh" className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <RefreshCw className={`w-4 h-4 text-gray-400 ${listFetching ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-sm text-gray-500">Loading…</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-600">
              <Phone className="w-8 h-8" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            [...conversations]
                .sort((a, b) => {
                  if (!a.last_timestamp) return 1
                  if (!b.last_timestamp) return -1
                  return new Date(b.last_timestamp) - new Date(a.last_timestamp)
                })
                .map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                isActive={selectedId === conv.id}
                onClick={() => {
                  setSelectedId(conv.id)
                  setSidebarOpen(false) 
                }}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Right pane ── */}
      <main className="flex-1 flex flex-col min-h-0 bg-gray-900 overflow-hidden relative">
        {selectedId && active ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 bg-gray-950">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors shrink-0">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              )}
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {active.customer_name || active.customer_phone}
                </p>
                <p className="text-xs text-gray-500">
                  {active.customer_name ? active.customer_phone + ' · ' : ''}
                  Since {formatDate(active.created_at)}
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1" onScroll={handleScroll}>
              <div ref={topRef} />
              
              {chatLoading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-sm text-gray-500">Loading messages…</span>
                </div>
              ) : active.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-sm text-gray-600">No messages in this conversation.</span>
                </div>
              ) : (
                active.messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
              
              <div ref={bottomRef} />
            </div>

            {/* Floating Scroll Navigation Buttons */}
            {!showLeads && (showScrollTop || showScrollDown) && (
              <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
                {showScrollTop && (
                  <button
                    onClick={scrollToTop}
                    title="Scroll to Top"
                    className="p-3 bg-transparent hover:bg-gray-700 border border-gray-700 text-black rounded-full shadow-2xl transition-all flex items-center justify-center"
                  >
                    <ChevronUp className="w-4 h-4 text-black font-bold" />
                  </button>
                )}
                
                {showScrollDown && (
                  <button
                    onClick={scrollToBottom}
                    title="Scroll to Bottom"
                    className="p-3 bg-transparent hover:bg-gray-700 border border-gray-700 text-black rounded-full shadow-2xl transition-all flex items-center justify-center"
                  >
                    <ChevronDown className="w-4 h-4 text-black font-bold" />
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 relative">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="absolute top-3 left-3 p-1 rounded-lg hover:bg-gray-800 transition-colors">
                <ChevronRight className="w-3 h-3 text-gray-400" />
              </button>
            )}
            <MessageSquare className="w-12 h-12" />
            <p className="text-sm">Select a conversation to view messages</p>
          </div>
        )}
      </main>
    </div>
  )
}