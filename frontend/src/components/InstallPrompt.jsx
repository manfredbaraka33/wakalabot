import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('wk_install_dismissed')
    if (dismissed) return

    function handler(e) {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShow(false)
  }

  function dismiss() {
    localStorage.setItem('wk_install_dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-gray-900 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl z-50 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-indigo-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Sakinisha Wakalabot</p>
        <p className="text-xs text-gray-400 mt-0.5">Fungua haraka zaidi — kama app halisi kwenye simu yako.</p>
        <button
          onClick={install}
          className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Sakinisha
        </button>
      </div>
      <button onClick={dismiss} className="text-gray-500 hover:text-white shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}