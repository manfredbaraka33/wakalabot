import apiClient from './axios'

export const knowledgeApi = {
  /** Fetch all KB entries for the logged-in tenant */
  list: () => apiClient.get('/api/v1/knowledge').then((r) => r.data),

  /** Create a new KB entry */
  create: (content) =>
    apiClient.post('/api/v1/knowledge', { content }).then((r) => r.data),

  /** Update text + re-embed */
  update: (id, content) =>
    apiClient.put(`/api/v1/knowledge/${id}`, { content }).then((r) => r.data),

  /** Delete an entry by id */
  remove: (id) => apiClient.delete(`/api/v1/knowledge/${id}`),
}
