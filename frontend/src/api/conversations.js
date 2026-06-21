import apiClient from './axios'

export const getConversations = () =>
  apiClient.get('/api/v1/admin/chats').then((r) => r.data)

export const getConversation = (id) =>
  apiClient.get(`/api/v1/admin/chats/${id}`).then((r) => r.data)

export const getAllLeads = () =>
  apiClient.get('/api/v1/admin/leads').then((r) => r.data)

// Fetches the nested message history stream for the modal view
export const getConversationMessages = (id) =>
  apiClient.get(`/api/v1/admin/chats/${id}`).then((r) => r.data.messages || r.data)