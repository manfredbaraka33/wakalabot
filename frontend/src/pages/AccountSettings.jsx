import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { changePassword } from '../api/auth'

export default function AccountSettings() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [clientError, setClientError] = useState('')

  const mutation = useMutation({
    mutationFn: () => changePassword(form.current, form.next),
    onSuccess: () => setForm({ current: '', next: '', confirm: '' }),
  })

  function handleSubmit(e) {
    e.preventDefault()
    setClientError('')
    if (form.next !== form.confirm) {
      setClientError('New passwords do not match')
      return
    }
    if (form.next.length < 8) {
      setClientError('New password must be at least 8 characters')
      return
    }
    mutation.mutate()
  }

  const serverError =
    mutation.error?.response?.data?.detail || mutation.error?.message

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-[#6366f1]" />
        Change Password
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5"
      >
        {/* Current password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
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
          <label className="block text-sm font-medium text-gray-300 mb-1">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNext ? 'text' : 'password'}
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
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
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
          />
        </div>

        {/* Errors */}
        {(clientError || serverError) && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {clientError || serverError}
          </div>
        )}

        {/* Success */}
        {mutation.isSuccess && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Password changed successfully
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-60 text-black font-semibold text-sm rounded-lg px-4 py-2.5 transition-colors"
        >
          {mutation.isPending ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
