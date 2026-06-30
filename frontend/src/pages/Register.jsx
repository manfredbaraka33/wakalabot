import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, BotMessageSquare, Eye, EyeOff, AtSign } from 'lucide-react'
import useTenantStore from '../store/useTenantStore'
import apiClient from '../api/axios'
import WakalaLogo from '../components/Wakalalogo'

const schema = z
  .object({
    username: z
      .string()
      .min(3, 'Username angalau herufi 3')
      .max(50, 'Username ni ndefu mno')
      .regex(/^[a-zA-Z0-9_]+$/, 'Tumia herufi, namba na underscore (_) tu'),
    businessName: z.string().min(2, 'Jina la biashara angalau herufi 2'),
    phone: z.string().optional().or(z.literal('')),
    password: z.string().min(8, 'Neno la siri angalau herufi 8'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Maneno ya siri hayafanani",
    path: ['confirmPassword'],
  })

function InputField({ label, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'

export default function Register() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const setAuthResult = useTenantStore((s) => s.setAuthResult)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(data) {
    setServerError('')
    try {
      const res = await apiClient.post('/api/v1/auth/register', {
        username: data.username.toLowerCase(),
        business_name: data.businessName,
        phone: data.phone?.trim() || undefined,
        password: data.password,
      })
      setAuthResult(res.data)
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.response?.data?.detail ?? 'Usajili umeshindwa. Tafadhali jaribu tena.')
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
          <h1 className="text-xl font-semibold text-white mb-1">Fungua akaunti yako</h1>
          <p className="text-sm text-gray-400 mb-6">Anza ndani ya dakika chache. Endesha biashara yako kwa akili zaidi.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <InputField
              label="Username"
              error={errors.username?.message}
              hint="Herufi, namba na underscore tu. Mfano: juma_store"
            >
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  {...register('username')}
                  placeholder="juma_store"
                  className={inputCls + ' pl-9'}
                  autoComplete="username"
                />
              </div>
            </InputField>

            <InputField label="Jina la Biashara" error={errors.businessName?.message}>
              <input
                {...register('businessName')}
                placeholder="Duka Langu"
                className={inputCls}
              />
            </InputField>

            <InputField
              label="Namba ya Simu"
              error={errors.phone?.message}
              hint="Si lazima — kwa mawasiliano tu"
            >
              <input
                {...register('phone')}
                type="tel"
                placeholder="+255 712 345 678 (si lazima)"
                className={inputCls}
              />
            </InputField>

            <InputField label="Neno la Siri" error={errors.password?.message}>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Angalau herufi 8"
                  className={inputCls}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </InputField>

            <InputField label="Thibitisha Neno la Siri" error={errors.confirmPassword?.message}>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Rudia neno la siri"
                  className={inputCls}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </InputField>

            {serverError && (
              <div className="rounded-lg border-red-800 px-3 py-2 text-sm text-red-400">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Fungua Akaunti
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Una akaunti tayari?{' '}
            <Link to="/signin" className="text-indigo-400 hover:underline font-medium">
              Ingia
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}