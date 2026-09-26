import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

export default function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 bg-indigo-600 rounded-2xl p-4 shadow-2xl z-[200] flex items-center gap-3">
      <RefreshCw className="w-5 h-5 text-white shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Toleo jipya lipo</p>
        <p className="text-xs text-indigo-100">Bonyeza kusasisha</p>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="text-xs bg-white text-indigo-600 font-semibold px-3 py-1.5 rounded-lg shrink-0"
      >
        Sasisha
      </button>
    </div>
  )
}