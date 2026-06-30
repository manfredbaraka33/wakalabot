import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import ReactMarkdown from 'react-markdown'
import {
  BotMessageSquare, Send, Search, ArrowLeft, Sun, Moon,
  ChevronLeft, ChevronRight, BadgeCheck, Loader2, LogOut, X,
  Copy, Check, Download, ThumbsUp, ThumbsDown,User,Bot,ChevronDown,Maximize,
  Eye,EyeOff
} from 'lucide-react'
import WakalaLogo from '../components/Wakalalogo'
import remarkGfm from 'remark-gfm'
import RefreshButton from '../components/RefreshButton'

const API = import.meta.env.VITE_API_URL

// ─────────────────────────────────────────────────────────────────────────
// Tool labels for "thinking" badges
// ─────────────────────────────────────────────────────────────────────────
const TOOL_LABELS = {
  get_product_catalog: '📦 Inaangalia bidhaa zote...',
  get_service_catalog: '🛠️ Inaangalia huduma zote...',
  get_product_by_name: '📦 Inatafuta bidhaa...',
  get_service_by_name: '🛠️ Inatafuta huduma...',
  get_shop_info: '🏪 Inaangalia taarifa za duka...',
  check_stock: '📊 Inaangalia hifadhi...',
  search_knowledge_base: '🔍 Inatafuta taarifa...',
  save_lead: '💾 Inasave nia ya kununua...',
  save_customer_note: '📝 Inasave kumbukumbu...',
  calculate_order_total: '🧮 Inahesabu jumla...',
  calculate_delivery_cost: '🚚 Inaangalia bei ya delivery...',
  create_notification: '🔔 Inatuma arifa...',
  escalate_to_human: '👤 Inapeleka kwa mwanadamu...',
  get_customer_history: '📜 Inaangalia historia ya mteja...',
  generate_insight: '💡 Inachambua...',
  fetch_business_website: '🌐 Inapakua tovuti...',
  search_web: '🔍 Inatafuta mtandaoni...',
}

// ─────────────────────────────────────────────────────────────────────────
// Message actions — copy, feedback
// ─────────────────────────────────────────────────────────────────────────
function MessageActions({ messageId, content }) {
  const [rating, setRating] = useState(null)
  const [copied, setCopied] = useState(false)

  async function submitFeedback(r) {
    if (rating || !messageId) return
    setRating(r)
    try {
      await fetch(`${API}/api/v1/chat/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, rating: r }),
      })
    } catch {}
  }

  function copyText() {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {content && (
        <button
          onClick={copyText}
          title="Copy"
          className="p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-700 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
      {messageId && (
        <>
          <button
            onClick={() => submitFeedback('positive')}
            title="Good response"
            className={`p-1 rounded transition-colors ${rating === 'positive' ? 'text-emerald-400' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-700'}`}
          >
            <ThumbsUp className="w-3 h-3" />
          </button>
          <button
            onClick={() => submitFeedback('negative')}
            title="Bad response"
            className={`p-1 rounded transition-colors ${rating === 'negative' ? 'text-red-400' : 'text-gray-600 hover:text-gray-300 hover:bg-gray-700'}`}
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Account modal
// ─────────────────────────────────────────────────────────────────────────
function CustomerAccountModal({ customer, onClose, onUpdate }) {
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [error, setError] = useState('')
  const [pwError, setPwError] = useState('')
  const [saved, setSaved] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customer.token}`,
        },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Imeshindwa kuhifadhi'); return }
      const updated = { ...customer, name: data.name, phone: data.phone, token: data.token || customer.token }
      localStorage.setItem('wk_customer', JSON.stringify(updated))
      onUpdate(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Connection error') }
    finally { setSaving(false) }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwSaving(true)
    setPwError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customer.token}`,
        },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.detail || 'Imeshindwa kubadilisha'); return }
      setCurrentPw('')
      setNewPw('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 3000)
    } catch { setPwError('Connection error') }
    finally { setPwSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <h3 className="text-white font-semibold text-sm">Akaunti Yangu</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <form onSubmit={saveProfile} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Taarifa za Kibinafsi</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Jina</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Nambari ya Simu</label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                type="tel"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit" disabled={saving}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {saved ? '✓ Imehifadhiwa' : 'Hifadhi Mabadiliko'}
            </button>
          </form>

          <hr className="border-gray-800" />

          <form onSubmit={changePassword} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Badilisha Neno la Siri</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Neno la Siri la Sasa</label>
              <input
                type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Neno Jipya la Siri</label>
              <input
                type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Angalau herufi 6"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
            <button
              type="submit" disabled={pwSaving || !currentPw || !newPw}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {pwSaved ? '✓ Imebadilishwa' : 'Badilisha Neno la Siri'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Auth forms
// ─────────────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Imeshindwa kuingia'); return }
      onSuccess(data)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Nambari ya Simu</label>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+255 712 345 678"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
          autoFocus
        />
      </div>
      <div>
  <label className="block text-xs font-medium text-gray-400 mb-1.5">Neno la Siri</label>
  <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'} 
        value={password} 
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••"
        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-4 pr-10 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
      />
      <button
        type="button" 
        onClick={() => setShowPassword(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
        title={showPassword ? "Ficha neno la siri" : "Onesha neno la siri"}
      >
        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit" disabled={loading || !phone || !password}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Ingia
      </button>
    </form>
  )
}

function ClaimNumberForm({ phone, onResult, onBack }) {
  const [claimantName, setClaimantName] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/claim-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          claimant_name: claimantName.trim(),
          claimant_contact: contact.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Imeshindwa kutuma madai'); return }
      onResult(data)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-lg p-3">
        <p className="text-indigo-400 text-xs font-semibold mb-1">Nambari Tayari Ipo</p>
        <p className="text-gray-300 text-xs leading-relaxed">
          Nambari <span className="text-white font-mono">{phone}</span> tayari imesajiliwa.
          Kama ni yako kweli, jaza fomu hii. Tutakupigia simu kukuthibitisha.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Jina Lako Kamili</label>
          <input
            type="text" value={claimantName} onChange={e => setClaimantName(e.target.value)}
            placeholder="Jina kama linavyoonekana kwenye kitambulisho"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
            autoFocus maxLength={100}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Njia Nyingine ya Kuwasiliana
          </label>
          <input
            type="text" value={contact} onChange={e => setContact(e.target.value)}
            placeholder="WhatsApp au nambari mbadala"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
            maxLength={200}
          />
          <p className="text-xs text-gray-600 mt-1">
            Nambari hii itatumika kukupigia simu ili kuthibitisha madai yako
          </p>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button" onClick={onBack}
            className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            Rudi
          </button>
          <button
            type="submit" disabled={loading || !claimantName || !contact}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Tuma Madai
          </button>
        </div>
      </form>
    </div>
  )
}

function RegisterForm({ onSuccess }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [claimResult, setClaimResult] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowClaim(false)
    try {
      const res = await fetch(`${API}/api/v1/customer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setShowClaim(true)
        } else {
          setError(data.detail || 'Imeshindwa kusajili')
        }
        return
      }
      onSuccess(data)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  if (claimResult) {
    return (
      <div className="space-y-4">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
          <p className="text-green-400 text-sm font-semibold">✅ Madai Yako Yamesajiliwa</p>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Nambari yako ya madai</p>
            <p className="text-white font-mono text-lg font-bold tracking-widest">{claimResult.claim_code}</p>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">{claimResult.message}</p>
        </div>
        <button
          onClick={() => { setClaimResult(null); setShowClaim(false) }}
          className="w-full py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors"
        >
          Rudi Nyuma
        </button>
      </div>
    )
  }

  if (showClaim) {
    return <ClaimNumberForm phone={phone} onResult={setClaimResult} onBack={() => setShowClaim(false)} />
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-lg p-3">
        <p className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Muhimu</p>
        <p className="text-gray-400 text-xs leading-relaxed">
          Tumia nambari ya simu unayomiliki wewe mwenyewe.
          Akaunti zilizo na nambari za uongo zinaweza kufutwa wakati wowote bila notisi.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Jina Lako</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Juma Hassan"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
          autoFocus maxLength={100}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Nambari ya Simu</label>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+255 712 345 678"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>
      
      <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">Neno la Siri</label>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'} 
          value={password} 
          onChange={e => setPassword(e.target.value)}
          placeholder="Angalau herufi 6"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-4 pr-10 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
        />
        <button
          type="button" // Prevents form trigger behavior on click
          onClick={() => setShowPassword(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
          title={showPassword ? "Ficha neno la siri" : "Onesha neno la siri"}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit" disabled={loading || !name || !phone || !password}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Jisajili
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Auth modal overlay — shows business context so customer knows why
// ─────────────────────────────────────────────────────────────────────────
function AuthModal({ activeBiz, authMode, setAuthMode, onSuccess }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {activeBiz && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 bg-gray-800/50 rounded-t-2xl">
            <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="text-indigo-400 text-sm font-bold">
                {activeBiz.biz_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{activeBiz.biz_name}</p>
              <p className="text-gray-400 text-xs">
                {authMode === 'login'
                  ? `Ingia kuendelea kuongea na ${activeBiz.biz_name}`
                  : `Jisajili kuanza kuongea na ${activeBiz.biz_name}`}
              </p>
            </div>
          </div>
        )}
        {!activeBiz && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
            <WakalaLogo />
            <div>
              
              <p className="text-gray-400 text-xs">Customer Service AI</p>
            </div>
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              Ingia
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              Jisajili
            </button>
          </div>

          {authMode === 'login'
            ? <LoginForm onSuccess={onSuccess} />
            : <RegisterForm onSuccess={onSuccess} />}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export default function CustomerChat() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(!slug)

  // Auth state
  const [customer, setCustomer] = useState(() => {
    const stored = localStorage.getItem('wk_customer')
    return stored ? JSON.parse(stored) : null
  })
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('wk_customer'))
  const [authMode, setAuthMode] = useState('login')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  // Directory + chat state
  const [directory, setDirectory] = useState([])
  const [search, setSearch] = useState('')
  const [activeBiz, setActiveBiz] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [bizError, setBizError] = useState(null)
  const bottomRef = useRef(null)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [fullImage, setFullImage] = useState(null);

  const [notice, setNotice] = useState(null)
  const [noticeRead, setNoticeRead] = useState(false)


  // ── Load directory ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/api/v1/chat/directory`)
      .then(r => r.json())
      .then(setDirectory)
      .catch(() => {})
  }, [])


  

  // ── Load business from slug — happens regardless of auth ───────────────
  useEffect(() => {
    if (!slug) return
    fetch(`${API}/api/v1/chat/business/${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(biz => {
        setActiveBiz(biz)

        // Load notice for this business
        fetch(`${API}/api/v1/chat/notice/${slug}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.notice) {
              setNotice(data.notice)
              // Check if this customer already read this notice
              const readKey = `wk_notice_read_${slug}_${data.notice.slice(0, 20)}`
              setNoticeRead(!!localStorage.getItem(readKey))
            }
          })
          .catch(() => {})
        setBizError(null)

        if (!authed) {
          setShowAuthModal(true)
          return
        }
        loadHistory(slug, biz)
      })
      .catch(() => setBizError('Business not found.'))
  }, [slug])

  useEffect(() => {
    if (bottomRef.current && !showScrollDown) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages?.length])

  // 2. Detect when the user scrolls up
  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    // Show button if we are more than 150px away from the bottom
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 150
    setShowScrollDown(isScrolledUp)
  }

  // 3. Scroll to bottom when button is clicked
  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // ── Load chat history for current customer + business ──────────────────
  async function loadHistory(bizSlug, biz) {
    const storedCustomer = JSON.parse(localStorage.getItem('wk_customer') || 'null')
    if (!storedCustomer) {
      setMessages([{
        role: 'assistant',
        content: `Habari! Karibu ${biz.biz_name}. Naweza kukusaidia nini leo?`,
        image_url: null, id: null,
      }])
      return
    }
    try {
      const res = await fetch(
        `${API}/api/v1/chat/history/${bizSlug}?customer_phone=${encodeURIComponent(storedCustomer.phone)}`,
        { headers: { 'Authorization': `Bearer ${storedCustomer.token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.messages?.length > 0) {
          setMessages(data.messages.map(m => ({
            id: m.id || null,
            role: m.role,
            content: m.content,
            image_url: m.image_url || null,
          })))
          return
        }
      }
    } catch {}
    setMessages([{
      role: 'assistant',
      content: `Habari ${storedCustomer.name}! Karibu ${biz.biz_name}. Naweza kukusaidia nini leo?`,
      image_url: null, id: null,
    }])
  }

  // ── Auth success — close modal, load chat ───────────────────────────────
  function handleAuthSuccess(c) {
    localStorage.setItem('wk_customer', JSON.stringify(c))
    setCustomer(c)
    setAuthed(true)
    setShowAuthModal(false)
    if (activeBiz) loadHistory(activeBiz.slug, activeBiz)
  }

  // ── Select business from directory ──────────────────────────────────────
  function selectBiz(biz) {
    setActiveBiz(biz)
    setBizError(null)
    navigate(`/chat/${biz.slug}`)
    if (!authed) {
      setShowAuthModal(true)
    } else {
      loadHistory(biz.slug, biz)
    }
  }

  // ── Send message ─────────────────────────────────────────────────────────
  async function doSend(text) {
    if (!text.trim() || !activeBiz || loading) return
    if (!authed) {
      setShowAuthModal(true)
      return
    }
    setMessages(prev => [...prev, { role: 'user', content: text.trim(), image_url: null }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          customer_token: customer.token,
          customer_phone: customer.phone,
          tenant_slug: activeBiz.slug,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        let errorString = 'Something went wrong.'
        if (typeof err.detail === 'string') {
          errorString = err.detail
        } else if (Array.isArray(err.detail)) {
          errorString = err.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        }
        setMessages(prev => [...prev, {
          id: null, role: 'assistant', content: errorString, image_url: null,
        }])
        return
      }

      const data = await res.json()
      setMessages(prev => [...prev, {
        id: data.id, role: 'assistant', content: data.reply,
        image_url: data.image_url || null, tools_used: data.tools_used || [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant', content: 'Connection error. Please try again.', image_url: null,
      }])
    } finally {
      setLoading(false)
    }
  }

  function sendMessage(e) { e.preventDefault(); doSend(input) }

  const filtered = directory.filter(b => b.biz_name.toLowerCase().includes(search.toLowerCase()))

  // Image download handler
  async function downloadImage(url) {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const objUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = 'wakalabot-image.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(objUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  // ── Main layout ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', overflow: 'hidden' }} className="bg-gray-950">

      {/* Auth modal — overlay, shows business context */}
      {showAuthModal && (
        <AuthModal
          activeBiz={activeBiz}
          authMode={authMode}
          setAuthMode={setAuthMode}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Account modal */}
      {showAccount && customer && (
        <CustomerAccountModal
          customer={customer}
          onClose={() => setShowAccount(false)}
          onUpdate={(updated) => setCustomer(updated)}
        />
      )}

      {/* ── Left panel — hidden when entering via direct business link ── */}
      {!slug && (
        <>
          <div style={{ width: sidebarOpen ? 288 : 0, minWidth: 0, transition: 'width 0.2s', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }} className="border-r border-gray-800 bg-gray-900">

            <div style={{ flexShrink: 0 }} className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <WakalaLogo />
                </div>
                <button onClick={toggle} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text" placeholder="Search businesses..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="py-2">
              {filtered.length === 0 && <p className="text-gray-600 text-xs text-center py-8">No businesses found</p>}
              {filtered.map(biz => (
                <button
                  key={biz.slug} onClick={() => selectBiz(biz)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${activeBiz?.slug === biz.slug ? 'bg-gray-800 border-r-2 border-indigo-500' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                    {biz.logo_url ? (
                    <img src={biz.logo_url} alt={biz.biz_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-indigo-400 text-xs font-bold">{biz.biz_name.charAt(0).toUpperCase()}</span>
                  )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{biz.biz_name}</p>
                      {biz.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    </div>
                    <p className="text-gray-500 text-xs">AI Assistant</p>
                  </div>
                </button>
              ))}
            </div>

            {authed && customer && (
              <div style={{ flexShrink: 0 }} className="p-3 border-t border-gray-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => setShowAccount(true)}
                  className="flex items-center gap-2 min-w-0 hover:bg-gray-800 rounded-lg px-2 py-1 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="text-indigo-400 text-xs font-bold">{customer?.name?.charAt(0)}</span>
                  </div>
                  <p className="text-gray-400 text-xs truncate">{customer?.name}</p>
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('wk_customer')
                    setCustomer(null)
                    setAuthed(false)
                    setShowAuthModal(true)
                  }}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  title="Toka"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{ flexShrink: 0, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="bg-gray-900 border-r border-gray-800 hover:bg-gray-800 transition-colors text-gray-500 hover:text-white"
          >
            {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </>
      )}

      {/* ── Right panel ── */}
      <div
        style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        // className={showAuthModal ? 'filter blur-sm pointer-events-none' : ''}
        className={`relative ${showAuthModal ? 'filter blur-sm pointer-events-none' : ''}`}
      >
        {!activeBiz ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto">
                <BotMessageSquare className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-gray-400 text-sm font-medium">Select a business to start chatting</p>
              <p className="text-gray-600 text-xs">Choose from the directory on the left</p>
              <RefreshButton /> <br />
              <Link to='/' className='text-indigo-600'>Home</Link>
            </div>
          </div>
        ) : bizError ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-red-400 text-sm">{bizError}</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ flexShrink: 0 }} className="px-4 py-3 border-b border-gray-800 bg-gray-900 flex items-center gap-3">
              {slug && (
                <button onClick={() => navigate('/chat')} className="text-gray-500 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden">
                  {activeBiz.logo_url ? (
                    <img src={activeBiz.logo_url} alt={activeBiz.biz_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-indigo-400 text-xs font-bold">{activeBiz.biz_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-white text-sm font-semibold">{activeBiz.biz_name}</p>
                  {activeBiz.is_verified && <BadgeCheck className="w-4 h-4 text-indigo-400 shrink-0" />}
                </div>
                <p className="text-emerald-400 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  AI Assistant Online
                </p>
              </div>
              {authed && customer && (
                <div className='flex gap-2'>
                  <button onClick={toggle} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
                  <button onClick={() => setShowAccount(true)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-indigo-400 text-xs font-bold">{customer.name?.charAt(0)}</span>
                  </div>
                  
                </button>
                </div>
              )}
            </div>

            {/* Notice banner */}
            {notice && activeBiz && (
              <div
                className={`shrink-0 flex items-start gap-3 px-4 py-3 border-b border-amber-500/20 transition-all ${
                  noticeRead
                    ? 'bg-amber-500/5'
                    : 'bg-amber-500/10 animate-pulse'
                }`}
                style={noticeRead ? {} : { animationDuration: '2s' }}
              >
                <span className="text-amber-400 text-base shrink-0 mt-0.5">
                  {noticeRead ? '📢' : '⚠️'}
                </span>
                <p className="text-amber-300 text-xs leading-relaxed flex-1">{notice}</p>
                {!noticeRead && (
                  <button
                    onClick={() => {
                      setNoticeRead(true)
                      const readKey = `wk_notice_read_${activeBiz.slug}_${notice.slice(0, 20)}`
                      localStorage.setItem(readKey, '1')
                    }}
                    className="shrink-0 text-[10px] text-amber-400 border border-amber-500/30 rounded-md px-2 py-0.5 hover:bg-amber-500/20 transition-colors"
                  >
                    Got it
                  </button>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" onScroll={handleScroll}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`group relative max-w-xs lg:max-w-md flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role=='user' ? (
                        <div className="shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                          <User className="w-4 h-4 text-gray-300" />
                        </div>
                      ):(
                        <div className="shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center mb-1">
                          <Bot className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    {msg.content && (
                      <div className={`prose prose-invert prose-sm max-w-none px-4 py-2.5 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-indigo-700 text-yellow-100 rounded-br-sm'
                          : 'bg-gray-800 text-white rounded-bl-sm prose-p:text-white prose-strong:text-white'
                      }`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}
                        
                        components={{
                          a: ({ node, ...props }) => (
                            <a 
                              {...props} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-indigo-400 hover:text-indigo-300 underline font-medium break-all"
                            />
                          )
                        }}
                        
                        >{msg.content}</ReactMarkdown>
                      </div>
                    )}

                    {msg.role === 'assistant' && (
                      <MessageActions messageId={msg.id} content={msg.content} />
                    )}

                    {msg.image_url && (
                      <div className="relative mt-1">
                        <img
                          src={msg.image_url} alt="Product"
                          className="rounded-xl max-w-full border border-gray-700 block"
                          onError={e => e.target.style.display = 'none'}
                        />
                        <button
                          onClick={() => downloadImage(msg.image_url)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg  bg-green-950 text-black hover:bg-indigo-300"
                          title="Download image"
                        >
                          <Download className="w-3.5 h-3 text-green-100" />
                        </button>
                        {/* New Expand Button */}
                        <button
                          onClick={() => setFullImage(msg.image_url)}
                          className="absolute top-2 right-10 p-1.5 rounded-lg bg-green-950 text-black hover:bg-indigo-300"
                          title="View full size"
                        >
                          <Maximize className="w-3.5 h-3 text-green-100" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 space-y-2 max-w-xs">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="text-xs text-gray-500 italic">Inafikiri...</p>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
              
              {showScrollDown && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-28 right-6 p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-full shadow-2xl transition-all flex items-center justify-center z-10"
              >
                <ChevronDown className="w-5 h-5 text-indigo-400" />
              </button>
            )}

            {/* Input */}
            <form onSubmit={sendMessage} style={{ flexShrink: 0 }} className="p-4 border-t border-gray-800 bg-gray-900">
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Andika ujumbe..." value={input}
                  onChange={e => setInput(e.target.value)} disabled={loading || showAuthModal}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  type="submit" disabled={!input.trim() || loading || showAuthModal}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-gray-600 text-xs mt-2">
                WakalaBot inaweza kukosea. Thibitisha taarifa muhimu.
              </p>
              {slug && (
                <p className="text-center mt-1">
                  <button
                    onClick={() => navigate('/chat')}
                    className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                  >
                    Tazama biashara nyingine →
                  </button>
                </p>
              )}
            </form>
          </>
        )}
      </div>
        
        {fullImage && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setFullImage(null)}
            >
              <img 
                src={fullImage} 
                alt="Full view" 
                className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
              />
              <button 
                className="absolute top-4 right-4 text-white hover:text-gray-300"
                onClick={() => setFullImage(null)}
              >
                Close
              </button>
            </div>
          )}

    </div>
  )
}