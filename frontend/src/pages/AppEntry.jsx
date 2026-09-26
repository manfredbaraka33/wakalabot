import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * PWA entry point. When a customer installs Wakalabot as an app from
 * a specific business chat link, reopening the installed app should
 * NOT dump them on the generic marketing landing page with no way back.
 * This checks for their last visited chat and sends them straight there.
 */
export default function AppEntry() {
  const navigate = useNavigate()

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true

    const lastSlug = localStorage.getItem('wk_last_chat_slug')

    if (isStandalone && lastSlug) {
      navigate(`/chat/${lastSlug}`, { replace: true })
    }
    // If not standalone (regular browser visit) or no last chat exists,
    // do nothing — fall through to showing the normal landing page.
  }, [navigate])

  return null // renders nothing itself, just redirects or falls through
}