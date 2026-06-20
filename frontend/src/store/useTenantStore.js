import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useTenantStore = create(
  persist(
    (set) => ({
      tenantId: null,
      user: null,
      token: null,

      // Called after a successful /auth/register or /auth/login response
      setAuthResult: ({ token, tenant_id, user }) =>
        set({
          token,
          tenantId: tenant_id,
          user,
        }),

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),

      logout: () =>
        set({
          tenantId: null,
          user: null,
          token: null,
        }),
    }),
    { name: 'wakalabot-tenant' }
  )
)

export default useTenantStore