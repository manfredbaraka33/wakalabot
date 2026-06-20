import axios from 'axios'
import useTenantStore from '../store/useTenantStore'

const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach auth + tenant headers to every request
apiClient.interceptors.request.use((config) => {
  const { tenantId, token } = useTenantStore.getState()
  // Only include tenant headers when an auth token is present.
  // This avoids sending custom headers during unauthenticated flows
  // (e.g. /auth/login, /auth/register), which can trigger CORS
  // preflights in some dev setups.
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
    if (tenantId) config.headers['X-Tenant-ID'] = tenantId
  }
  return config
})

// Auto-logout on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useTenantStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export default apiClient
