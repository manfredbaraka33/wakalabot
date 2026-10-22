import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { PalettePicker } from './TemplatePicker'
import { useStudio } from './StudioContext'
import { errText, studioApi } from './studioApi'

const inputCls = 'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function StudioAccount() {
  const { creator, refresh, signOut } = useStudio()
  const { data: catalog } = useQuery({ queryKey: ['studio-catalog'], queryFn: () => studioApi.catalog().then((r) => r.data) })
  const [brand, setBrand] = useState('')
  const [contact, setContact] = useState('')
  const [style, setStyle] = useState('giza')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!creator) return
    setBrand(creator.brand_name || '')
    setContact(creator.contact_phone || '')
    setStyle(creator.default_style || 'giza')
  }, [creator])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await studioApi.updateMe({ brand_name: brand, contact_phone: contact, default_style: style })
      await refresh()
      setMsg({ ok: true, text: 'Imehifadhiwa.' })
    } catch (err) {
      setMsg({ ok: false, text: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <p className="text-white font-semibold">@{creator?.username}</p>
        <p className="text-sm text-gray-500">{creator?.phone}</p>
      </div>
      <form onSubmit={save} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <p className="text-sm text-gray-400">Taarifa hizi zinajazwa kiotomatiki kwenye kila tangazo.</p>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Jina la Biashara</label>
          <input value={brand} onChange={(e) => setBrand(e.target.value.slice(0, 40))} maxLength={40} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1.5">Simu ya Mawasiliano</label>
          <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={20} placeholder="0712 345 678" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-2">Rangi unayopenda</label>
          <PalettePicker palettes={catalog?.palettes} value={style} onChange={setStyle} />
        </div>
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2.5 text-sm font-semibold">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Hifadhi
        </button>
      </form>
      <button onClick={signOut} className="w-full rounded-lg border border-gray-700 hover:border-red-500/50 text-red-400 py-2.5 text-sm">Toka</button>
    </div>
  )
}