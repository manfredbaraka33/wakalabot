import { WifiOff, RefreshCw } from 'lucide-react'

export default function OfflineScreen({ onRetry, message }) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-xs text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
          <WifiOff className="w-7 h-7 text-amber-400" />
        </div>
        <div>
          <p className="text-white font-semibold">Huna mtandao</p>
          <p className="text-sm text-gray-400 mt-1">
            {message || 'Unahitaji intaneti kutumia Wakalabot. Washa data au WiFi kisha jaribu tena.'}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Jaribu Tena
          </button>
        )}
      </div>
    </div>
  )
}