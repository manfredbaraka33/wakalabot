import apiClient from './axios'

export function changePassword(currentPassword, newPassword) {
  return apiClient.post('/api/v1/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}



export const getMe = async () => {
  const response = await apiClient.get('/api/v1/auth/me'); // Adjust path if needed
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await apiClient.patch('/api/v1/auth/me/profile', data);
  return response.data;
};
