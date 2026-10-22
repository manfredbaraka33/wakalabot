import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'wk_studio_token'

export const getStudioToken = () => localStorage.getItem(TOKEN_KEY)
export const setStudioToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearStudioToken = () => localStorage.removeItem(TOKEN_KEY)

const client = axios.create({ baseURL: `${BASE_URL}/api/v1/studio`, timeout: 90000 })

client.interceptors.request.use((config) => {
  const token = getStudioToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// An expired or invalid session sends the user back to login automatically.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = (err.config?.url || '').startsWith('/auth/')
    if (err.response?.status === 401 && getStudioToken() && !isAuthCall) {
      clearStudioToken()
      window.dispatchEvent(new Event('studio-logout'))
    }
    return Promise.reject(err)
  }
)

export function errText(err, fallback = 'Kuna tatizo. Tafadhali jaribu tena.') {
  if (!err?.response) {
    return navigator.onLine
      ? 'Seva haipatikani. Jaribu tena baada ya muda mfupi.'
      : 'Huna mtandao. Angalia intaneti kisha jaribu tena.'
  }
  const d = err.response.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg).join(', ')
  return fallback
}

// Media URLs come back relative; prefix the API host so <img> works in dev too.
export const mediaUrl = (path, download = false) =>
  path ? `${BASE_URL}${path}${download ? '&download=1' : ''}` : null

export const studioApi = {
  requestOtp: (phone, purpose) => client.post('/auth/request-otp', { phone, purpose }),
  verifyOtp: (phone, code, purpose) => client.post('/auth/verify-otp', { phone, code, purpose }),
  completeSignup: (data) => client.post('/auth/complete-signup', data),
  login: (identifier, password) => client.post('/auth/login', { identifier, password }),
  resetPassword: (token, new_password) => client.post('/auth/reset-password', { token, new_password }),
  me: () => client.get('/me'),
  updateMe: (data) => client.patch('/me', data),
  catalog: () => client.get('/catalog'),
  packs: () => client.get('/packs'),
  wallet: () => client.get('/wallet'),
  submitPayment: (pack_id, reference) => client.post('/payments', { pack_id, reference }),
  createJob: (formData) => client.post('/jobs', formData),
  getJob: (id) => client.get(`/jobs/${id}`),
  listJobs: () => client.get('/jobs'),
  deleteJob: (id) => client.delete(`/jobs/${id}`),
}


// Downloads without a page navigation. A plain <a href="/api/..."> is a navigation request,
// and the PWA service worker answers navigations with the landing page. fetch() is not affected.
export async function downloadMedia(path, filename) {
  const res = await fetch(mediaUrl(path))
  const type = res.headers.get('content-type') || ''
  if (!res.ok || !type.startsWith('image/')) throw new Error('link-expired')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}