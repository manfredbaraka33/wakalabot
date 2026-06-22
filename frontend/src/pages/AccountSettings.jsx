import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, Building2, User, Mail, Phone, Loader2, Save } from 'lucide-react'
import { changePassword, getMe, updateProfile } from '../api/auth'

export default function AccountSettings() {
  const queryClient = useQueryClient()

  // --- Profile State ---
  const [profileForm, setProfileForm] = useState({ biz_name: '', email: '', phone: '' })
  
  // --- Password State ---
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [pwClientError, setPwClientError] = useState('')

  // 1. Fetch current user data
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: getMe,
  })

  // Pre-fill profile form when data loads
  useEffect(() => {
    if (tenantData?.user) {
      
      setProfileForm({
        biz_name: tenantData.user.business_name || '',
        email: tenantData.user.email || '',
        phone: tenantData.user.phone || '', // Assuming phone exists, adjust if needed
      })
    }
  }, [tenantData])

  // 2. Profile Update Mutation
  const profileMutation = useMutation({
    mutationFn: () => updateProfile(profileForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
    },
  })

  // 3. Password Update Mutation
  const pwMutation = useMutation({
    mutationFn: () => changePassword(pwForm.current, pwForm.next),
    onSuccess: () => setPwForm({ current: '', next: '', confirm: '' }),
  })

  // --- Handlers ---
  function handleProfileSubmit(e) {
    e.preventDefault()
    profileMutation.mutate()
  }

  function handlePwSubmit(e) {
    e.preventDefault()
    setPwClientError('')
    if (pwForm.next !== pwForm.confirm) {
      setPwClientError('New passwords do not match')
      return
    }
    if (pwForm.next.length < 8) {
      setPwClientError('New password must be at least 8 characters')
      return
    }
    pwMutation.mutate()
  }

  const pwServerError = pwMutation.error?.response?.data?.detail || pwMutation.error?.message
  const profileServerError = profileMutation.error?.response?.data?.detail || profileMutation.error?.message

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading account...
    </div>
  )

  return (
    <div className="max-w-xl space-y-8 mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Account Settings</h1>
        <p className="text-sm text-gray-400">Manage your business profile and security credentials.</p>
      </div>

      {/* --- BUSINESS PROFILE SECTION --- */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#6366f1]" />
          Business Profile
        </h2>
        <form
          onSubmit={handleProfileSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Business Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={profileForm.biz_name}
                onChange={(e) => setProfileForm({ ...profileForm, biz_name: e.target.value })}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 pl-10 pr-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              />
            </div>
          </div>

          {profileServerError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {profileServerError}
            </div>
          )}

          {profileMutation.isSuccess && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Profile updated successfully
            </div>
          )}

          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors"
          >
            {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {profileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </section>

      {/* --- CHANGE PASSWORD SECTION --- */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-[#6366f1]" />
          Change Password
        </h2>
        <form
          onSubmit={handlePwSubmit}
          className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5"
        >
          {/* Current password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showNext ? 'text' : 'password'}
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                required
                minLength={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              />
              <button
                type="button"
                onClick={() => setShowNext((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
          </div>

          {/* Confirm new password */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>

          {/* Errors */}
          {(pwClientError || pwServerError) && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {pwClientError || pwServerError}
            </div>
          )}

          {/* Success */}
          {pwMutation.isSuccess && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Password changed successfully
            </div>
          )}

          <button
            type="submit"
            disabled={pwMutation.isPending}
            className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-black font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors"
          >
            {pwMutation.isPending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  )
}