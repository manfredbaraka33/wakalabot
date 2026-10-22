import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquareText, LayoutDashboard, ArrowRight,Wrench,Sparkles } from 'lucide-react'
import WakalaLogo from '../components/Wakalalogo'

/**
 * This is the screen an installed PWA user sees when they open the app
 * with no specific context (no remembered chat, or they explicitly want
 * to choose). It replaces the marketing LandingPage for standalone/installed
 * sessions, since a marketing page makes no sense to someone who already
 * has the app on their home screen.
 */
export default function AppHome() {
  const navigate = useNavigate()
  const [lastSlug, setLastSlug] = useState(null)
  const [isMerchant, setIsMerchant] = useState(false)

  useEffect(() => {
    setLastSlug(localStorage.getItem('wk_last_chat_slug'))
    // Merchant session token — check whatever your auth store actually
    // persists to localStorage/sessionStorage for logged-in merchants
    const merchantToken = localStorage.getItem('token') || localStorage.getItem('wk_merchant_token')
    setIsMerchant(!!merchantToken)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <WakalaLogo />
          <p className="text-sm text-gray-500 mt-2">Chagua unachotaka kufanya</p>
        </div>

        <div className="space-y-3">
          {lastSlug && (
            <button
              onClick={() => navigate(`/chat/${lastSlug}`)}
              className="w-full flex items-center gap-3 bg-gray-900 border border-indigo-500/30 hover:border-indigo-500 rounded-2xl p-4 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                <MessageSquareText className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Endelea Kuchati</p>
                <p className="text-xs text-gray-500 truncate">Rudi kwenye mazungumzo yako ya mwisho</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
            </button>
          )}

          <button
            onClick={() => navigate('/chat')}
            className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <MessageSquareText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Tafuta Biashara/Taasisi</p>
              <p className="text-xs text-gray-500">Angalia orodha ya biashara/taasisi zote</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
          </button>

          <button
            onClick={() => navigate('/studio/app')}
            className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors text-left"
          >
  <div className="w-11 h-11 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
    <Sparkles className="w-5 h-5 text-sky-400" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-white">Wakalabot Studio</p>
    <p className="text-xs text-gray-500">Matangazo na orodha ya bei (bure)</p>
  </div>
  <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
</button>

          <button
            onClick={() => navigate(isMerchant ? '/dashboard' : '/signin')}
            className="w-full flex items-center gap-3 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {isMerchant ? 'Dashibodi Yangu' : 'Nina Biashara/Taasisi — Ingia'}
              </p>
              <p className="text-xs text-gray-500">
                {isMerchant ? 'Simamia bot yako' : 'Ingia kusimamia bot yako'}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-600 shrink-0" />
          </button>
        </div>

        <p className="text-center text-xs text-gray-700">
          Huna akaunti ya biashara?{' '}
          <button onClick={() => navigate('/register')} className="text-indigo-400 hover:underline">
            Jisajili bure
          </button>
        </p>
      </div>
    </div>
  )
}