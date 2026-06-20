import apiClient from './axios'

/**
 * Build a FormData object from a plain product object.
 * If `data.imageFile` is a File instance it is appended as the `image` field.
 * All other fields are appended as strings (falsy values are skipped for
 * partial-update requests).
 */
function toFormData(data, partial = false) {
  const fd = new FormData()
  const fields = ['name', 'description', 'price', 'stock_quantity', 'is_active', 'category']
  for (const key of fields) {
    const val = data[key]
    if (partial && (val === undefined || val === null)) continue
    if (val !== undefined && val !== null) {
      fd.append(key, String(val))
    }
  }
  if (data.imageFile instanceof File) {
    fd.append('image', data.imageFile)
  }
  return fd
}

export const productsApi = {
  list: () => apiClient.get('/api/v1/products').then((r) => r.data),

  create: (data) =>
    apiClient
      .post('/api/v1/products', toFormData(data), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  update: (id, data) =>
    apiClient
      .put(`/api/v1/products/${id}`, toFormData(data, true), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  remove: (id) => apiClient.delete(`/api/v1/products/${id}`),
}
