import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, AtSign, Eye, EyeOff, KeyRound, Loader2, Phone } from 'lucide-react'
import WakalaLogo from '../components/Wakalalogo'
import { useStudio } from './StudioContext'
import { errText, studioApi } from './studioApi'

const inputCls = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'
const btnCls = 'w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-white transition-colors'

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/studio"><WakalaLogo /></Link>
          <p className="text-xs font-semibold text-fuchsia-300 uppercase tracking-widest mt-2">Studio</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-gray-400 mb-6">{subtitle}</p>}
          {children}
        </div>
        {footer && <p className="mt-5 text-center text-sm text-gray-500">{footer}</p>}
      </div>
    </div>
  )
}

const ErrorBox = ({ msg }) =>
  msg ? <div className="rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300">{msg}</div> : null

function PhoneStep({ purpose, onSent }) {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (phone.replace(/\D/g, '').length < 9) {
      setError('Weka namba ya simu sahihi. Mfano: 0712 345 678')
      return
    }
    setBusy(true)
    setError('')
    try {
      await studioApi.requestOtp(phone, purpose)
      onSent(phone)
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Namba ya Simu</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="0712 345 678" autoFocus className={inputCls + ' pl-9'} />
        </div>
        <p className="mt-1 text-xs text-gray-600">Tutakutumia SMS yenye nambari ya uthibitisho.</p>
      </div>
      <ErrorBox msg={error} />
      <button type="submit" disabled={busy} className={btnCls}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Tuma Nambari
      </button>
    </form>
  )
}

function CodeStep({ phone, purpose, onVerified, onBack }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(60)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await studioApi.verifyOtp(phone, code, purpose)
      onVerified(data.token)
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    try {
      await studioApi.requestOtp(phone, purpose)
      setCooldown(60)
    } catch (err) {
      setError(errText(err))
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
        Tumetuma SMS kwenda <span className="font-mono">{phone}</span>. Weka nambari ya tarakimu 6.
      </div>
      <input type="text" inputMode="numeric" maxLength={6} value={code} autoFocus
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
        className={inputCls + ' text-center tracking-[0.5em] font-mono text-lg'} />
      <ErrorBox msg={error} />
      <button type="submit" disabled={busy || code.length !== 6} className={btnCls}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Thibitisha
      </button>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={onBack} className="text-gray-500 hover:text-gray-300 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Badilisha namba
        </button>
        <button type="button" onClick={resend} disabled={cooldown > 0}
          className="text-indigo-400 hover:text-indigo-300 disabled:text-gray-600">
          {cooldown > 0 ? `Tuma tena baada ya ${cooldown}s` : 'Sikupokea? Tuma tena'}
        </button>
      </div>
    </form>
  )
}

export function StudioSignup() {
  const nav = useNavigate()
  const { signIn, token } = useStudio()
  const [params] = useSearchParams()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [signupToken, setSignupToken] = useState('')
  const [f, setF] = useState({ username: '', password: '', brand_name: '', ref: params.get('ref') || '', accept: false })
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (token) nav('/studio/app', { replace: true }) }, [token, nav])
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  async function finish(e) {
    e.preventDefault()
    setError('')
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(f.username)) return setError('Username: herufi, namba au _ tu (3 hadi 20).')
    if (/^\d+$/.test(f.username)) return setError('Username isiwe namba tupu.')
    if (f.password.length < 8) return setError('Neno la siri liwe angalau herufi 8.')
    if (!f.accept) return setError('Kubali Masharti na Faragha ili kuendelea.')
    setBusy(true)
    try {
      const { data } = await studioApi.completeSignup({
        token: signupToken, username: f.username, password: f.password,
        brand_name: f.brand_name, ref: f.ref, accept_terms: true,
      })
      signIn(data.token, data.creator)
      nav('/studio/app', { replace: true })
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  const titles = {
    phone: ['Fungua akaunti ya Studio', 'Hatua 1 ya 3 — namba yako ya simu'],
    code: ['Thibitisha namba', 'Hatua 2 ya 3 — nambari ya SMS'],
    details: ['Maliza usajili', 'Hatua 3 ya 3 — username na neno la siri'],
  }

  return (
    <AuthLayout title={titles[step][0]} subtitle={titles[step][1]}
      footer={<>Una akaunti? <Link to="/studio/login" className="text-indigo-400 hover:underline">Ingia</Link></>}>
      {step === 'phone' && <PhoneStep purpose="signup" onSent={(p) => { setPhone(p); setStep('code') }} />}
      {step === 'code' && (
        <CodeStep phone={phone} purpose="signup" onBack={() => setStep('phone')}
          onVerified={(t) => { setSignupToken(t); setStep('details') }} />
      )}
      {step === 'details' && (
        <form onSubmit={finish} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={f.username} onChange={(e) => set('username', e.target.value)} placeholder="juma_store"
                autoCapitalize="none" className={inputCls + ' pl-9'} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Neno la Siri</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={f.password} onChange={(e) => set('password', e.target.value)}
                placeholder="Angalau herufi 8" autoComplete="new-password" className={inputCls + ' pr-10'} />
              <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Jina la Biashara <span className="text-gray-600">(si lazima)</span>
            </label>
            <input value={f.brand_name} onChange={(e) => set('brand_name', e.target.value)} maxLength={80}
              placeholder="e.g. Amina Fashion" className={inputCls} />
          </div>
          {f.ref && <p className="text-xs text-emerald-400">Umealikwa na rafiki — mwaliko umewekwa ({f.ref}).</p>}
          <label className="flex items-start gap-2.5 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={f.accept} onChange={(e) => set('accept', e.target.checked)} className="mt-0.5 accent-indigo-500" />
            <span>
              Nina umri wa miaka 18+ na nakubali <Link to="/terms" target="_blank" className="text-indigo-400 hover:underline">Masharti</Link> na{' '}
              <Link to="/privacy" target="_blank" className="text-indigo-400 hover:underline">Sera ya Faragha</Link>.
            </span>
          </label>
          <ErrorBox msg={error} />
          <button type="submit" disabled={busy} className={btnCls}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Fungua Akaunti
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export function StudioLogin() {
  const nav = useNavigate()
  const { signIn, token } = useStudio()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (token) nav('/studio/app', { replace: true }) }, [token, nav])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await studioApi.login(identifier.trim(), password)
      signIn(data.token, data.creator)
      nav('/studio/app', { replace: true })
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Karibu tena" subtitle="Ingia kwenye Wakalabot Studio"
      footer={<>Huna akaunti? <Link to="/studio/signup" className="text-indigo-400 hover:underline">Jisajili bure</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Username au Namba ya Simu</label>
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoCapitalize="none" autoFocus
            placeholder="juma_store au 0712 345 678" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Neno la Siri</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" className={inputCls + ' pr-10'} />
            <button type="button" onClick={() => setShowPw((v) => !v)} tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <ErrorBox msg={error} />
        <button type="submit" disabled={busy || !identifier || !password} className={btnCls}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ingia
        </button>
        <p className="text-center text-xs">
          <Link to="/studio/forgot" className="text-gray-500 hover:text-gray-300">Umesahau neno la siri?</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export function StudioForgot() {
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    if (pw.length < 8) return setError('Neno la siri liwe angalau herufi 8.')
    setBusy(true)
    setError('')
    try {
      await studioApi.resetPassword(resetToken, pw)
      setStep('done')
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Weka neno jipya la siri" footer={<Link to="/studio/login" className="text-indigo-400 hover:underline">Rudi kuingia</Link>}>
      {step === 'phone' && <PhoneStep purpose="reset" onSent={(p) => { setPhone(p); setStep('code') }} />}
      {step === 'code' && (
        <CodeStep phone={phone} purpose="reset" onBack={() => setStep('phone')}
          onVerified={(t) => { setResetToken(t); setStep('newpw') }} />
      )}
      {step === 'newpw' && (
        <form onSubmit={save} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Neno jipya (angalau herufi 8)"
              autoComplete="new-password" className={inputCls + ' pl-9'} autoFocus />
          </div>
          <ErrorBox msg={error} />
          <button type="submit" disabled={busy} className={btnCls}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Hifadhi
          </button>
        </form>
      )}
      {step === 'done' && (
        <div className="text-center space-y-3">
          <p className="text-emerald-400 text-sm">Neno la siri limebadilishwa.</p>
          <Link to="/studio/login" className={btnCls}>Ingia sasa</Link>
        </div>
      )}
    </AuthLayout>
  )
}