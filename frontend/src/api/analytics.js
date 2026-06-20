import apiClient from './axios'

export async function getAnalyticsStats() {
  const { data } = await apiClient.get('/api/v1/admin/analytics/stats')
  return data
}