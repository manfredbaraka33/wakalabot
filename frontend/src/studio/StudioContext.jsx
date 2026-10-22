import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { studioApi, getStudioToken, setStudioToken, clearStudioToken } from './studioApi'

const Ctx = createContext(null)
export const useStudio = () => useContext(Ctx)

export function StudioProvider({ children }) {
  const qc = useQueryClient()
  const [token, setToken] = useState(getStudioToken())

  const { data: creator, isLoading, refetch } = useQuery({
    queryKey: ['studio-me'],
    queryFn: () => studioApi.me().then((r) => r.data),
    enabled: !!token,
    retry: false,
    staleTime: 30000,
  })

  useEffect(() => {
    const onLogout = () => {
      setToken(null)
      qc.removeQueries({ queryKey: ['studio-me'] })
    }
    window.addEventListener('studio-logout', onLogout)
    return () => window.removeEventListener('studio-logout', onLogout)
  }, [qc])

  const signIn = useCallback((tok, creatorData) => {
    setStudioToken(tok)
    setToken(tok)
    qc.setQueryData(['studio-me'], creatorData)
  }, [qc])

  const signOut = useCallback(() => {
    clearStudioToken()
    setToken(null)
    qc.removeQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('studio') })
  }, [qc])

  return (
    <Ctx.Provider value={{ token, creator, loading: !!token && isLoading, refresh: refetch, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  )
}