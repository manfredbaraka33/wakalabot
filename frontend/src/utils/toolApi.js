import apiClient from '../api/axios'
import { explainError } from './errors'

export async function compressImage(file, maxSide = 1600, quality = 0.86) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

export async function postForImage(path, formData) {
  try {
    const res = await apiClient.post(path, formData, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return URL.createObjectURL(res.data)
  } catch (err) {
    let detail = null
    const blob = err?.response?.data
    if (blob instanceof Blob) {
      try { detail = JSON.parse(await blob.text())?.detail } catch { /* not json */ }
    }
    throw new Error(typeof detail === 'string' ? detail : explainError(err))
  }
}

export function downloadImage(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export async function shareImage(url, filename) {
  try {
    const blob = await (await fetch(url)).blob()
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
      return
    }
  } catch (e) {
    if (e?.name === 'AbortError') return
  }
  downloadImage(url, filename)
}

export function recall(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
export function remember(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}