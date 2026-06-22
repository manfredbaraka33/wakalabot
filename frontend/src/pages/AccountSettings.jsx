import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Phone, Lock, KeyRound, Building2, AtSign, Mail, Eye, EyeOff } from 'lucide-react'
import apiClient from '../api/axios'

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function StatusMsg({ status, saved = 'Changes saved', error: errorMsg = 'Failed — try again.' }) {
  if (status === 'saved') return <p className="text-xs text-emerald-400 font-medium">✓ {saved}</p>
  if (status === 'error') return <p className="text-xs text-red-400 font-medium">{errorMsg}</p>
  return null
}

export default function AccountSettings() {
  const queryClient = useQueryClient()

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [bizName, setBizName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profileStatus, setProfileStatus] = useState('idle')
  const [profileError, setProfileError] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwStatus, setPwStatus] = useState('idle')
  const [pwError, setPwError] = useState('')

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: () => apiClient.get('/api/v1/auth/me').then((r) => r.data),
  })

  const user = tenantData?.user ?? {}

  useEffect(() => {
    if (user && Object.keys(user).length > 0) {
      setBizName(user.business_name || user.biz_name || '')
      setUsername(user.username || '')
      setEmail(user.email || '')
      setPhone(user.phone || '')
    }
  }, [tenantData, user])

  async function saveProfile(e) {
    e.preventDefault()
    setProfileStatus('saving')
    setProfileError('')
    try {
      await apiClient.patch('/api/v1/auth/me/profile', {
        biz_name: bizName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
      setProfileStatus('saved')
      setTimeout(() => setProfileStatus('idle'), 3000)
    } catch (err) {
      setProfileError(err?.response?.data?.detail || 'Failed to save profile changes.')
      setProfileStatus('error')
      setTimeout(() => setProfileStatus('idle'), 4000)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setPwError('')
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.')
      return
    }
    if (newPw.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    setPwStatus('saving')
    try {
      await apiClient.post('/api/v1/auth/change-password', {
        current_password: currentPw,
        new_password: newPw,
      })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwStatus('saved')
      setTimeout(() => setPwStatus('idle'), 3000)
    } catch (err) {
      setPwError(err?.response?.data?.detail || 'Failed to update password.')
      setPwStatus('idle')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading profile details...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your business profile and login credentials.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center shrink-0">
          <span className="text-2xl font-bold text-indigo-400">
            {(username ?? bizName ?? 'U')[0]?.toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-base truncate">{bizName || '—'}</p>
          <p className="text-indigo-400 text-sm truncate">@{username || '—'}</p>
          {email && <p className="text-gray-500 text-xs mt-0.5">{email}</p>}
          {phone && <p className="text-gray-500 text-xs">{phone}</p>}
        </div>
      </div>

      <SectionCard
        icon={Building2}
        title="Business Information"
        description="Update your business name, unique username and core communication entries."
      >
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Business Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="My Business"
                className={inputCls + ' pl-9'}
                maxLength={255}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className={inputCls + ' pl-9'}
                autoCapitalize="none"
                maxLength={100}
                required
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Used for unique identification and login routes</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Email <span className="text-gray-600">(optional)</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@example.com"
                className={inputCls + ' pl-9'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Phone Number <span className="text-gray-600">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 712 345 678"
                className={inputCls + ' pl-9'}
              />
            </div>
          </div>

          {profileError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {profileError}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <StatusMsg status={profileStatus} saved="Profile updated successfully" />
            <button
              type="submit"
              disabled={profileStatus === 'saving'}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors ml-auto"
            >
              {profileStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {profileStatus === 'saving' ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        icon={KeyRound}
        title="Change Password"
        description="Ensure your systems stay protected with updated keys."
      >
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                className={inputCls + ' pl-9 pr-10'}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                className={inputCls + ' pl-9 pr-10'}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                className={inputCls + ' pl-9'}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {pwError && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {pwError}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <StatusMsg status={pwStatus} saved="Password updated successfully" />
            <button
              type="submit"
              disabled={pwStatus === 'saving' || !currentPw || !newPw || !confirmPw}
              className="flex items-center gap-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white transition-colors ml-auto"
            >
              {pwStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {pwStatus === 'saving' ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  )
}