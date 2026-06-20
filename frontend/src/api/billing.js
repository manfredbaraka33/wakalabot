import api from './axios'

/**
 * GET /billing/wallet — returns { balance, last_updated }
 */
export async function getWallet() {
  const { data } = await api.get('/api/v1/billing/wallet')
  return data
}

/**
 * GET /billing/transactions — returns array of transactions
 */
export async function getTransactions() {
  const { data } = await api.get('/api/v1/billing/transactions')
  return data
}
