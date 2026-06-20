import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { getAnalyticsStats } from '../api/analytics'

const DEFAULT_ERROR = 'Unable to load analytics right now.'

export default function useLiveAnalytics(intervalMs = 15_000) {
  const mountedRef = useRef(true)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadStats = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)

    try {
      const data = await getAnalyticsStats()
      if (mountedRef.current) {
        startTransition(() => {
          setStats(data)
          setError('')
        })
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.response?.data?.detail || DEFAULT_ERROR)
      }
    } finally {
      if (mountedRef.current) {
        if (background) setRefreshing(false)
        else setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const initialLoadId = window.setTimeout(() => {
      void loadStats(false)
    }, 0)
    const intervalId = window.setInterval(() => {
      void loadStats(true)
    }, intervalMs)

    return () => {
      mountedRef.current = false
      window.clearTimeout(initialLoadId)
      window.clearInterval(intervalId)
    }
  }, [intervalMs, loadStats])

  const reload = useCallback(() => {
    void loadStats(true)
  }, [loadStats])

  return { stats, loading, refreshing, error, reload }
}