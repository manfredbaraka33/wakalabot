import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const SA_KEY = 'sa_token'

export const getSAToken = () => localStorage.getItem(SA_KEY)
export const setSAToken = (t) => localStorage.setItem(SA_KEY, t)
export const clearSAToken = () => localStorage.removeItem(SA_KEY)

// Un-authed call to get the token
const publicClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

function saClient() {
  const token = getSAToken()
  return axios.create({
    baseURL: `${BASE_URL}/api/v1`,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

export const superadminLogin = (secret) =>
  publicClient.post('/superadmin/auth', { secret })

export const getStats = () => saClient().get('/superadmin/stats')
export const getRevenueTrend = (days = 30) =>
  saClient().get(`/superadmin/revenue-trend?days=${days}`)
export const getUserGrowth = (days = 30) =>
  saClient().get(`/superadmin/user-growth?days=${days}`)
export const getAiActivity = (days = 30) =>
  saClient().get(`/superadmin/ai-activity?days=${days}`)

export const getTenants = (params) =>
  saClient().get('/superadmin/tenants', { params })
export const updateTenant = (id, data) =>
  saClient().put(`/superadmin/tenants/${id}`, data)
export const deleteTenant = (id) =>
  saClient().delete(`/superadmin/tenants/${id}`)
export const resetPassword = (id, new_password) =>
  saClient().post(`/superadmin/tenants/${id}/reset-password`, { new_password })
export const addCoins = (id, coins) =>
  saClient().post(`/superadmin/tenants/${id}/add-coins`, { coins })

export const getTransactions = (params) =>
  saClient().get('/superadmin/transactions', { params })
export const getWallets = (params) =>
  saClient().get('/superadmin/wallets', { params })

export const getTickets = (params) =>
  saClient().get('/superadmin/tickets', { params })
export const updateTicket = (id, data) =>
  saClient().put(`/superadmin/tickets/${id}`, data)

export const toggleVerify = (id) =>
  saClient().patch(`/superadmin/tenants/${id}/verify`)

export const getTenantDetails = (id) =>
  saClient().get(`/superadmin/tenants/${id}/details`)

export const getTenantSubscription = (id) =>
  saClient().get(`/superadmin/tenants/${id}/subscription`)

export const setTenantPlan = (id, plan_id) =>
  saClient().post(`/superadmin/tenants/${id}/set-plan`, { plan_id })

export const getPaymentRequests = (params) =>
  saClient().get('/superadmin/payment-requests', { params })

export const approvePayment = (id, admin_note) =>
  saClient().post(`/superadmin/payment-requests/${id}/approve`, { admin_note })

export const rejectPayment = (id, admin_note) =>
  saClient().post(`/superadmin/payment-requests/${id}/reject`, { admin_note })


export const getCustomers = (params) => saClient().get('/superadmin/customers', { params })
export const deleteCustomer = (id) => saClient().delete(`/superadmin/customers/${id}`)

export const getNumberClaims = () => saClient().get('/superadmin/number-claims')
export const updateNumberClaim = (id, action, admin_note) => 
  saClient().post(`/superadmin/number-claims/${id}/${action}`, { admin_note })

export const getTenantsForBroadcast = () => saClient().get('/superadmin/tenants')
export const sendBroadcast = (data) => saClient().post('/superadmin/broadcast', data)

export const getSuperAdminFeedback = (filter) => 
  saClient().get('/superadmin/feedback', {
    params: { rating: filter || undefined }
  });

