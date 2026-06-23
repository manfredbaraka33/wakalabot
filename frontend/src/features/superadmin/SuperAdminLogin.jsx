import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BotMessageSquare, Lock, Eye, EyeOff } from 'lucide-react'
import { superadminLogin, setSAToken } from '../../api/superadmin'
import WakalaLogo from '../../components/Wakalalogo'

export default function SuperAdminLogin() {
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await superadminLogin(secret)
      setSAToken(res.data.token)
      navigate('/superadmin')
    } catch {
      setError('Invalid superadmin secret. Access denied.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <WakalaLogo />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Nerve Center</h1>
            <p className="text-sm text-gray-400">Wakalabot SuperAdmin</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-gray-500" />
            <p className="text-sm text-gray-400">Enter the superadmin secret key</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Superadmin secret key"
              required
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 pr-10 text-sm text-white placeholder-gray-500 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !secret}
            className="w-full rounded-lg bg-[#6366f1] hover:bg-[#20bd5a] disabled:opacity-50 py-3 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {loading ? 'Authenticating…' : 'Access Nerve Center'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-700 mt-6">
          Authorized personnel only. All access is logged.
        </p>
      </div>
    </div>
  )
}
