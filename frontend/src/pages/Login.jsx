import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, BotMessageSquare, Eye, EyeOff, AtSign } from 'lucide-react'
import useTenantStore from '../store/useTenantStore'
import apiClient from '../api/axios'
import WakalaLogo from '../components/Wakalalogo'
import { explainError } from '../utils/errors'
import useOnlineStatus from '../hooks/useOnlineStatus'
import { WifiOff } from 'lucide-react'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'

export default function Login() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const setAuthResult = useTenantStore((s) => s.setAuthResult)
  const online = useOnlineStatus()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

    async function onSubmit(data) {
    setServerError('')
    if (!navigator.onLine) {
      setServerError('Huna mtandao. Angalia intaneti yako kisha jaribu tena.')
      return
    }
    try {
      const res = await apiClient.post('/api/v1/auth/login', {
        username: data.username.trim().toLowerCase(),
        password: data.password,
      })
      setAuthResult(res.data)
      navigate('/dashboard')
        } catch (err) {
      // 401 means the server answered and the credentials were wrong.
      // Anything else (offline, timeout, 5xx) gets its own honest message.
      if (err.response?.status === 401) {
        setServerError(err.response?.data?.detail ?? 'Username au neno la siri si sahihi.')
      } else {
        setServerError(explainError(err))
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/">

            <WakalaLogo />

          </Link>
          <p className="text-sm text-gray-400">Jukwaa mahiri la kuendesha biashara yako</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-white mb-1">Karibu tena</h1>
          <p className="text-sm text-gray-400 mb-6">Ingia kwenye dashibodi yako</p>

          {!online && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">Huna mtandao. Washa intaneti ili kuingia.</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  {...register('username')}
                  placeholder="your_username"
                  className={inputCls + ' pl-9'}
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
              {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  className={inputCls + ' pr-10'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-400">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Ingia
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Hauna akaunti?{' '}
            <Link to="/register" className="text-indigo-400 hover:underline font-medium">
              Tengeneza akaunti
            </Link>
            
          </p>
          <p className="text-center mt-1">
             <Link className="text-xs text-indigo-600 hover:text-indigo-800 underline transition-colors"
           to='/home'>Nyumbani</Link>
          </p>
         
        </div>
      </div>
    </div>
  )
}