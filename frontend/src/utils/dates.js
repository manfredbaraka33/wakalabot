export function formatExpiry(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function timeLeft(iso) {
  if (!iso) return ''
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'imeisha'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `dakika ${mins} zimebaki`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `masaa ${hrs} yamebaki`
  return `siku ${Math.floor(hrs / 24)} zimebaki`
}

export function isExpired(iso) {
  return !!iso && new Date(iso).getTime() <= Date.now()
}