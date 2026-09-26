import { useEffect, useState } from 'react'
import LandingPage from '../pages/LandingPage'
import AppHome from '../pages/AppHome'

export default function RootEntry() {
  const [isStandalone, setIsStandalone] = useState(null) // null = still checking

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setIsStandalone(standalone)
  }, [])

  if (isStandalone === null) return null // brief flash-avoid, renders nothing for a tick
  return isStandalone ? <AppHome /> : <LandingPage />
}