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

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

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

  const [otpCode, setOtpCode] = useState('')
  const [showOtpField, setShowOtpField] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)

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
    
    // Step 1: If OTP hasn't been requested yet, fetch it first
    if (!showOtpField) {
      setSendingOtp(true)
      setPwError('')
      try {
        const res = await fetch(`${API}/api/v1/customer/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: customer.phone }),
        })
        const data = await res.json()
        if (!res.ok) {
          const errMsg = Array.isArray(data.detail) ? data.detail[0]?.msg : (data.detail || 'Imeshindwa kutuma OTP')
          setPwError(errMsg)
          return
        }
        setShowOtpField(true)
      } catch { setPwError('Connection error') }
      finally { setSendingOtp(false) }
      return
    }

    // Step 2: If OTP field is visible, run the password update process
    setPwSaving(true)
    setPwError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${customer.token}`,
        },
        body: JSON.stringify({ 
          current_password: currentPw, 
          new_password: newPw, 
          code: otpCode.trim() 
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = Array.isArray(data.detail) ? data.detail[0]?.msg : (data.detail || 'Imeshindwa kubadilisha')
        setPwError(errMsg)
        return
      }
      setCurrentPw('')
      setNewPw('')
      setOtpCode('')
      setShowOtpField(false)
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
          
          <form onSubmit={changePassword} className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Badilisha Neno la Siri</p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Neno la Siri la Sasa</label>
              <input
                type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                disabled={showOtpField}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Neno Jipya la Siri</label>
              <input
                type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Angalau herufi 6"
                disabled={showOtpField}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            {/* CONDITIONAL PATCH: Only show OTP input after step 1 succeeds */}
            {showOtpField && (
              <div className="animate-fadeIn">
                <label className="block text-xs text-amber-400 mb-1.5">Ingiza Nambari ya OTP niliyotumiwa kwa ujumbe</label>
                <input
                  type="text" value={otpCode} onChange={e => setOtpCode(e.target.value)}
                  placeholder="Nambari 6" maxLength={6}
                  className="w-full bg-gray-800 border border-amber-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 text-center font-mono tracking-widest"
                />
              </div>
            )}

            {pwError && <p className="text-red-400 text-xs">{pwError}</p>}
            
            <button
              type="submit" disabled={pwSaving || sendingOtp || !currentPw || !newPw || (showOtpField && !otpCode)}
              className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {(pwSaving || sendingOtp) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {pwSaved 
                ? '✓ Imebadilishwa' 
                : showOtpField 
                  ? 'Thibitisha & Badilisha' 
                  : 'Tuma nambari ya OTP'}
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
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-gray-50 font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Ingia
      </button>
      <p className="text-center mt-1">
         <Link className="text-xs text-indigo-600 hover:text-indigo-800 underline transition-colors"
           to='/home'>Nyumbani</Link>
      </p>
    </form>
  )
}

function OTPRegisterForm({ onSuccess }) {
  const [step, setStep] = useState('phone') // 'phone' | 'verify'
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  async function requestOtp(e) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        // Extract the exact error message text if FastAPI sent a validation list
        const errMsg = Array.isArray(data.detail) 
          ? data.detail[0]?.msg 
          : (data.detail || 'Imeshindwa kutuma OTP');
        
        setError(errMsg);
        console.error("Server Error Details:", data.detail); // Keeps a detailed log in your browser console
        return;
      }

      setStep('verify')
      setResendCooldown(60)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/customer/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), name: name.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Imeshindwa kuthibitisha'); return }
      onSuccess(data)
    } catch { setError('Connection error') }
    finally { setLoading(false) }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={requestOtp} className="space-y-4">
        <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-lg p-3">
          <p className="text-indigo-400 text-xs leading-relaxed">
            Tutakutumia SMS yenye nambari ya uthibitisho. Tumia nambari unayoimiliki wewe mwenyewe.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Nambari ya Simu</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+255 712 345 678"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
            autoFocus
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit" disabled={loading || !phone}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Tuma Nambari ya Uthibitisho
        </button>
        <p className="text-center mt-1">
         <Link className="text-xs text-indigo-600 hover:text-indigo-800 underline transition-colors"
           to='/home'>Nyumbani</Link>
      </p>
      </form>
    )
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-4">
      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3">
        <p className="text-emerald-400 text-xs">
          Tumetuma SMS kwa <span className="font-mono">{phone}</span>. Weka nambari hapo chini.
        </p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Nambari ya OTP</label>
        <input
          type="text" inputMode="numeric" maxLength={6} value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-indigo-500"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Jina Lako</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Juma Hassan"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">Neno la Siri</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Angalau herufi 6"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-4 pr-10 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500"
          />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        type="submit" disabled={loading || code.length !== 6 || !name || !password}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Thibitisha na Jisajili
      </button>
      <button
        type="button" onClick={requestOtp} disabled={resendCooldown > 0}
        className="w-full text-xs text-gray-300 hover:text-gray-300 disabled:opacity-40"
      >
        {resendCooldown > 0 ? `Tuma tena baada ya ${resendCooldown}s` : 'Sikupokea? Tuma tena'}
      </button>
    </form>
  )
}



// ─────────────────────────────────────────────────────────────────────────
// Auth modal overlay — shows business context so customer knows why
// ─────────────────────────────────────────────────────────────────────────


function AuthModal({ activeBiz, authMode, setAuthMode, onSuccess, onGuestEnter, showGuestInfo, setShowGuestInfo, enterGuestMode }) {
  // Use either onGuestEnter or enterGuestMode
  const handleGuestClick = onGuestEnter || enterGuestMode;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-h-130 p-4 overflow-auto max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {activeBiz && (
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 bg-gray-800/50 rounded-t-2xl">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              {activeBiz.logo_url ? (
                <img src={activeBiz.logo_url} alt={activeBiz.biz_name} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-indigo-400 text-xs font-bold">{activeBiz.biz_name.charAt(0).toUpperCase()}</span>
              )}
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
          {/* Guest chat option - Instant entry with collapsible info */}
          <div className="mt-1 pt-3 border-t border-gray-800/60 space-y-2">
            <button
              type="button"
              onClick={handleGuestClick}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 border border-blue-500/30 transition-colors shadow-lg shadow-blue-600/20"
            >
              Chati bila kusajili →
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowGuestInfo(!showGuestInfo)}
                className="text-[11px] text-gray-400 hover:text-gray-300 underline transition-colors inline-flex items-center gap-1"
              >
                <span>ℹ️</span> {showGuestInfo ? "Ficha maelezo" : "Soma vigezo vya mgeni"}
              </button>
            </div>

            {showGuestInfo && (
              <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-3 space-y-1.5 text-left animate-in fade-in duration-200">
                <p className="text-xs font-semibold text-white">Mambo ya kuzingatia:</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  📋 Mfanyabiashara ataona mazungumzo yako kwenye dashibodi yake.
                </p>
                <p className="text-[11px] text-amber-400/80 leading-relaxed">
                  ⚠️ Historia yako haitahifadhiwa — itafutwa ukifunga kivinjari.
                </p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  ✅ Unaweza kujisajili wakati wowote ili kupata historia.
                </p>
              </div>
            )}
          </div>

          {/* Login / Register Toggle */}
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${authMode === 'login' ? 'bg-indigo-600 text-gray-50' : 'text-gray-400'}`}
            >
              Ingia
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
            >
              Jisajili
            </button>
          </div>

          {authMode === 'login'
            ? <LoginForm onSuccess={onSuccess} />
            : <OTPRegisterForm onSuccess={onSuccess} />}
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
  const [noticeDismissed, setNoticeDismissed] = useState(false)

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

  const [isGuest, setIsGuest] = useState(false)
  const [guestPhone, setGuestPhone] = useState(null)
  const [showGuestInfo, setShowGuestInfo] = useState(false)


  function initGuestSession() {
  const key = `wk_guest_${slug}`
  let id = localStorage.getItem(key)
  if (!id) {
    id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(key, id)
  }
  return id
}

function enterGuestMode() {
  const id = initGuestSession()
  setGuestPhone(id)
  setIsGuest(true)
  setShowAuthModal(false)
  setShowGuestInfo(false)
  if (activeBiz) {
    setMessages([{
      role: 'assistant',
      content: `Habari! Karibu ${activeBiz.biz_name}. Naweza kukusaidia nini leo?`,
      image_url: null, id: null,
    }])
  }
}


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
      // .then(biz => {
      //   setActiveBiz(biz)
            .then(biz => {
            setActiveBiz(biz)
            // Remember this so PWA reopens land back here, not on marketing page
            localStorage.setItem('wk_last_chat_slug', biz.slug)

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
          // Check if this device already has a guest session for this slug
          const existingGuestId = localStorage.getItem(`wk_guest_${slug}`)
          if (existingGuestId) {
            setGuestPhone(existingGuestId)
            setIsGuest(true)
            setMessages([{
              role: 'assistant',
              content: `Habari! Karibu tena ${biz.biz_name}. Naweza kukusaidia nini leo?`,
              image_url: null, id: null,
            }])
          } else {
            setShowAuthModal(true)
          }
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
      image_urls: [], 
      id: null,
      timestamp: new Date().toISOString(),
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
        setMessages(data.messages.map(m => {
          // Extract embedded image tags and get clean text
          const { cleanText, extractedImages } = parseMessageContent(m.content || '')
          
          // Combine images from raw text, array fields, and legacy single image fields
          const allImages = [
            ...extractedImages,
            ...(Array.isArray(m.image_urls) ? m.image_urls : []),
            ...(m.image_url ? [m.image_url] : [])
          ]

          return {
            id: m.id || null,
            role: m.role,
            content: cleanText,
            image_urls: [...new Set(allImages)], // Remove duplicate URLs
            timestamp: m.timestamp || m.created_at || new Date().toISOString(),
          }
        }))
        return
      }
    }
  } catch {}

  setMessages([{
    role: 'assistant',
    content: `Habari ${storedCustomer.name}! Karibu ${biz.biz_name}. Naweza kukusaidia nini leo?`,
    image_urls: [], 
    id: null,
    timestamp: new Date().toISOString(),
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
// Helper function to extract all [IMAGE_URL: ...] tags and clean text
function parseMessageContent(rawText) {
  if (!rawText) return { cleanText: '', extractedImages: [] };

  const regex = /\[IMAGE_URL:\s*(https?:\/\/[^\]\s]+)\]/gi;
  const extractedImages = [];
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    extractedImages.push(match[1]);
  }

  // Remove the [IMAGE_URL: ...] tags from the visible text
  const cleanText = rawText.replace(regex, '').trim();
  return { cleanText, extractedImages };
}

async function doSend(text) {
  if (!text.trim() || !activeBiz || loading) return
  if (!authed && !isGuest) {
    setShowAuthModal(true)
    return
  }

  setMessages(prev => [...prev, { 
    role: 'user',
    content: text.trim(),
    image_urls: [],
    timestamp: new Date().toISOString(),
  }])
  setInput('')
  setLoading(true)

  try {
    const res = await fetch(`${API}/api/v1/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isGuest
          ? {
              message: text.trim(),
              customer_phone: guestPhone,
              tenant_slug: activeBiz.slug,
              is_guest: true,
            }
          : {
              message: text.trim(),
              customer_token: customer.token,
              customer_phone: customer.phone,
              tenant_slug: activeBiz.slug,
            }
      ),
    })

    if (!res.ok) {
  const err = await res.json().catch(() => ({}))
  
  // 1. If you WANT to show your fixed default text on 402 instead of the backend message:
  let errorString = res.status === 402 
    ? 'Samahani. Huduma hii haipatikani kwa sasa.' 
    : (typeof err.detail === 'string' ? err.detail : 'Samahani. Huduma hii haipatikani kwa sasa.')

  // 2. If err.detail is a validation array (FastAPI 422 errors)
  if (Array.isArray(err.detail)) {
    errorString = err.detail.map(e => `${e.loc?.join('.') || ''}: ${e.msg}`).join(', ')
  }

  setMessages(prev => [...prev, {
    id: null, 
    role: res.status === 402 ? 'system' : 'assistant', 
    content: errorString, 
    image_urls: [],
    timestamp: new Date().toISOString(),
  }])

  // 3. UNLOCK THE UI: Reset loading so the user can send messages again
  setLoading(false)
  return
}

    const data = await res.json()

    // 1. Extract all image tags from raw message text and clean the text
    const { cleanText, extractedImages } = parseMessageContent(data.reply || '')

    // 2. Combine regex images with any images directly returned in API payload
    const allImages = [
      ...extractedImages,
      ...(Array.isArray(data.image_urls) ? data.image_urls : []),
      ...(data.image_url ? [data.image_url] : [])
    ]

    // 3. Remove duplicate image links
    const uniqueImages = [...new Set(allImages)]

    setMessages(prev => [...prev, {
      id: data.id, 
      role: 'assistant', 
      content: cleanText,
      image_urls: uniqueImages, 
      tools_used: data.tools_used || [],
      timestamp: data.timestamp || new Date().toISOString(),
    }])
  } catch {
    setMessages(prev => [...prev, {
      role: 'assistant', 
      content: 'Connection error. Please try again.', 
      image_urls: [],
      timestamp: new Date().toISOString(),
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
          onGuestEnter={enterGuestMode}
          showGuestInfo={showGuestInfo}
          setShowGuestInfo={setShowGuestInfo}
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
              {/* <p className="text-gray-400 text-sm font-medium">Select a business to start chatting</p>
              <p className="text-gray-600 text-xs">Choose from the directory on the left</p> */}
              <p className="text-gray-600 text-xs">Inapakia.... tafadhari subiri</p> 
              <RefreshButton /> <br />
              <Link to='/home' className='text-indigo-600'>Nyumbani</Link>
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
              {slug && !isGuest && (
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
              {isGuest ? (
                <div className="flex gap-2">
                  <button
                  onClick={() => {
                    setIsGuest(false)
                    setGuestPhone(null)
                    setShowAuthModal(true)
                    setAuthMode('register')
                    setMessages([])
                  }}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-indigo-500/10 transition-colors"
                >
                  ← Ingia / Jisajili
                </button>
                 <button onClick={toggle} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : authed && customer && (
                <div className='flex gap-2'>
                  <button onClick={toggle} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setShowAccount(true)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-indigo-400 text-xs font-bold">{customer.name?.charAt(0)}</span>
                    </div>
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

            {/* Guest mode indicator */}
            {isGuest && (
              <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-gray-800/40 border-b border-gray-700/30">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
                  Unachati kama mgeni
                </p>
                <button
                  onClick={() => { setIsGuest(false); setGuestPhone(null); setShowAuthModal(true); setAuthMode('register') }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Jisajili →
                </button>
              </div>
            )}

            {/* Notice banner */}
           {notice && activeBiz && !noticeDismissed && (
            <div
              className={`shrink-0 flex items-start gap-3 px-4 py-3 border-b border-amber-500/30 dark:border-amber-500/20 transition-all ${
                noticeRead
                  ? 'bg-blue-800 dark:bg-blue-950'
                  : 'bg-blue-900 dark:bg-blue-950 animate-pulse'
              }`}
              style={noticeRead ? {} : { animationDuration: '3s' }}
            >
              <span className="text-amber-100 dark:text-amber-400 text-base shrink-0 mt-0.5">
                {noticeRead ? '📢' : '⚠️'}
              </span>
              <p className="text-amber-100 text-center dark:text-amber-300 text-xs leading-relaxed flex-1 font-medium">{notice}</p>
              {!noticeRead ? (
                <button
                  onClick={() => {
                    setNoticeRead(true)
                    const readKey = `wk_notice_read_${activeBiz.slug}_${notice.slice(0, 20)}`
                    localStorage.setItem(readKey, '1')
                  }}
                  className="shrink-0 text-[10px] text-amber-100 dark:text-amber-100 border border-amber-600/40 dark:border-amber-500/30 rounded-md px-2 py-0.5 hover:bg-blue-900 dark:hover:bg-blue-950 transition-colors"
                >
                  Sawa
                </button>
              ) : (
                <button
                  onClick={() => setNoticeDismissed(true)}
                  className="shrink-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                  title="Ficha"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" onScroll={handleScroll}>
                            {messages.map((msg, i) => {
                if (msg.role === 'system') {
                  return (
                    <div key={i} className="flex justify-center my-2">
                      <div className="max-w-[85%] flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5">
                        <span className="text-amber-400 text-sm shrink-0">⚠️</span>
                        <p className="text-amber-300 text-xs leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  )
                }
                return (
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
                          ? 'bg-indigo-700 text-gray-50 rounded-br-sm'
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

                    {/* Normalize images to support both single 'image_url' and multiple 'image_urls' */}
                      {(() => {
                        const images = Array.isArray(msg.image_urls)
                          ? msg.image_urls
                          : msg.image_url
                            ? [msg.image_url]
                            : [];

                        if (images.length === 0) return null;

                        return (
                          <div className={`mt-2 grid gap-2 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {images.map((url, idx) => (
                              <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-700">
                                <img
                                  src={url}
                                  alt={`Product detail ${idx + 1}`}
                                  className="rounded-xl w-full max-h-60 object-cover block"
                                  onError={e => { e.currentTarget.style.display = 'none'; }}
                                />

                                {/* Action Overlay */}
                                <div className="absolute top-2 right-2 flex gap-1.5">
                                  <button
                                    onClick={() => setFullImage(url)}
                                    className="p-1.5 rounded-lg bg-green-950 text-black hover:bg-indigo-300 transition-colors"
                                    title="View full size"
                                  >
                                    <Maximize className="w-3.5 h-3.5 text-green-100" />
                                  </button>
                                  <button
                                    onClick={() => downloadImage(url)}
                                    className="p-1.5 rounded-lg bg-green-950 text-black hover:bg-indigo-300 transition-colors"
                                    title="Download image"
                                  >
                                    <Download className="w-3.5 h-3.5 text-green-100" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <p className={`text-[10px] mt-1 text-gray-400 w-full ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp ? formatTime(msg.timestamp) : ''}
                    </p>
                  </div>
                </div>
              )})}

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
            {/* Guest signup nudge */}
            {isGuest && (
              <div className="px-4 py-2 border-t border-gray-800/50 bg-gray-900/60 flex items-center justify-center gap-2">
                <span className="text-xs text-gray-600">Historia haitahifadhiwa.</span>
                <button
                  onClick={() => { setIsGuest(false); setGuestPhone(null); setShowAuthModal(true); setAuthMode('register') }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline transition-colors"
                >
                  Jisajili kuhifadhi
                </button>
              </div>
            )}
            <form onSubmit={sendMessage} style={{ flexShrink: 0 }} className="p-4 border-t border-gray-800 bg-gray-900">
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Andika ujumbe..." value={input}
                  onChange={e => setInput(e.target.value)} disabled={loading || (showAuthModal && !isGuest)}
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
                Wakalabot inaweza kukosea. Thibitisha taarifa muhimu.
              </p>
              {slug && !isGuest && (
                <p className="text-center mt-1">
                  <button
                    onClick={() => navigate('/chat')}
                    className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                  >
                    Tazama biashara nyingine →
                  </button>
                </p>
              )}
              <p className="text-center mt-2">
                <button className="text-xs text-indigo-600 hover:text-indigo-800 underline transition-colors"
               onClick={() => navigate('/home')}>Nyumbani</button>
              </p>
              
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