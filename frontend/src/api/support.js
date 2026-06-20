import api from './axios'

export const submitTicket = (data) => api.post('/api/v1/support/tickets', data)
export const getMyTickets = () => api.get('/api/v1/support/tickets')
