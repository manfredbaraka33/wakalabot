// Works for both axios errors and native fetch errors.
export function explainError(err, fallback = 'Kuna tatizo. Tafadhali jaribu tena.') {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const noResponse =
    err?.code === 'ERR_NETWORK' ||
    err?.message === 'Network Error' ||
    err?.name === 'TypeError' ||
    (err && err.response === undefined && !err.status)

  if (offline || noResponse) {
    return 'Huna mtandao. Angalia intaneti yako kisha jaribu tena.'
  }
  if (err?.name === 'AbortError' || err?.code === 'ECONNABORTED') {
    return 'Mtandao ni dhaifu sana. Jaribu tena.'
  }
  const status = err?.response?.status
  if (status === 429) return 'Umejaribu mara nyingi. Subiri dakika moja kisha jaribu tena.'
  if (status >= 500) return 'Kuna tatizo upande wetu. Jaribu tena baada ya muda mfupi.'
  return err?.response?.data?.detail || fallback
}

// fetch that gives up instead of hanging forever.
export async function fetchWithTimeout(url, options = {}, ms = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}