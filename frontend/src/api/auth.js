import apiClient from './axios'

export function changePassword(currentPassword, newPassword) {
  return apiClient.post('/api/v1/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
