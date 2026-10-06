import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Save, Loader2, Clock, MapPin, Phone, Link2, QrCode,
  Copy, Check, Zap, Brain, X, Code, Globe, Truck, FileText, Lock,
  Bell,Trash2Icon,ImageIcon
} from 'lucide-react'
import { useState, useRef,useEffect } from 'react'
import { useQuery, useQueryClient,useMutation } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import apiClient from '../../api/axios'

const schema = z.object({
  opening_time: z.string().optional(),
  closing_time: z.string().optional(),
  location: z.string().min(2),
  contact_phone: z.string().min(6),
  website_url: z.string().optional(),
  delivery_zones: z.string().optional(),
  business_description: z.string().optional(),
})

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}



export default function ShopSettings() {
  const [saveStatus, setSaveStatus] = useState('idle')
  const [copied, setCopied] = useState(false)
  const [copiedWidget, setCopiedWidget] = useState(false)
  const queryClient = useQueryClient()
  const qrRef = useRef(null)

  const [notice, setNotice] = useState('')
  const [noticeSaving, setNoticeSaving] = useState('idle')

  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef(null)
  const [isOpen24h, setIsOpen24h] = useState(false)


const { data: noticeData } = useQuery({
  queryKey: ['shop-notice'],
  queryFn: () => apiClient.get('/api/v1/knowledge/shop-notice').then(r => r.data),
})

useEffect(() => {
  if (noticeData) {
    setNotice(noticeData.notice ?? '')
  }
}, [noticeData])

  const { data: existing, isLoading } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/knowledge/shop-settings')
      return res.data
    },
  })

  const { data: tenantData } = useQuery({
    queryKey: ['tenant-info'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/auth/me')
      return res.data
    }
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await apiClient.get('/api/v1/billing/subscription')
      return res.data
    },
  })

  const { data: igStatus, refetch: refetchIg } = useQuery({
  queryKey: ['ig-status'],
  queryFn: () => apiClient.get('/api/v1/instagram/status').then(r => r.data),
})

useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('ig_connected')) {
    refetchIg()
    queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
    window.history.replaceState({}, '', '/dashboard/settings')
  }
  if (params.get('ig_error')) {
    alert(`Imeshindwa kuunganisha Instagram: ${params.get('ig_error')}`)
    window.history.replaceState({}, '', '/dashboard/settings')
  }
}, [])

  const hasSubscription = !!subscription?.has_subscription

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    values: {
      opening_time: existing?.opening_time === '24h' ? '' : (existing?.opening_time ?? ''),
      closing_time: existing?.closing_time === '24h' ? '' : (existing?.closing_time ?? ''), 
      location: existing?.location ?? '',
      contact_phone: existing?.contact_phone ?? '',
      website_url: existing?.website_url ?? '',
      delivery_zones: existing?.delivery_zones ?? '',
      business_description: existing?.business_description ?? '',
    },
  })

  useEffect(() => {
  if (existing?.opening_time === '24h') setIsOpen24h(true)
}, [existing])

  async function onSubmit(data) {
  setSaveStatus('saving')
  try {
    const payload = {
      ...data,
      opening_time: isOpen24h ? '24h' : data.opening_time,
      closing_time: isOpen24h ? '24h' : data.closing_time,
    }
    await apiClient.post('/api/v1/knowledge/shop-settings', payload)
    queryClient.invalidateQueries({ queryKey: ['shop-settings'] })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 3000)
  } catch {
    setSaveStatus('error')
    setTimeout(() => setSaveStatus('idle'), 4000)
  }
}

 
  const slug = tenantData?.user?.slug ?? null
  const baseUrl = window.location.origin
  const chatLink = slug ? `${baseUrl}/chat/${slug}` : null

  function handleCopy() {
    if (!chatLink) return
    navigator.clipboard.writeText(chatLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }



 async function handleDownloadQR() {
  try {
    const res = await apiClient.get('/api/v1/knowledge/qr-pdf', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-qrcode.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert('Imeshindwa kutengeneza QR. Tafadhali jaribu tena.')
  }
}



  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Inapakia...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mipangilio ya Biashara</h1>
        <p className="text-sm text-gray-400 mt-1">
          Weka taarifa sahihi za biashara yako ili AI yako ifanye kazi vizuri.
        </p>
      </div>

      {/* Business Logo */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Logo ya Biashara</h2>
            <p className="text-xs text-gray-400 mt-0.5">Inaonekana kwenye chati na widget. Picha za square (mraba) ni bora zaidi.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            onClick={() => logoInputRef.current?.click()}
            className="w-20 h-20 rounded-2xl bg-gray-800 border-2 border-dashed border-gray-700 hover:border-indigo-500 flex items-center justify-center cursor-pointer overflow-hidden transition-colors shrink-0"
          >
            {(logoPreview || tenantData?.user?.logo_url) ? (
              <img src={logoPreview || tenantData.user.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-6 h-6 text-gray-600" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
            >
              {tenantData?.user?.logo_url ? 'Badilisha Logo' : 'Pakia Logo'}
            </button>
            {tenantData?.user?.logo_url && (
              <button
                type="button"
              
                onClick={async () => {
                    try {
                      await apiClient.delete('/api/v1/knowledge/shop-logo');
                      queryClient.invalidateQueries({ queryKey: ['tenant-info'] });
                      setLogoPreview(null);
                    } catch (error) {
                      alert("Imeshindwa kufuta logo")
                    }
                  }}
                className="text-sm text-red-400 hover:text-red-300 font-medium block"
              >
                Futa Logo
              </button>
            )}
            <p className="text-xs text-gray-600">JPEG, PNG au WebP. Max 5MB.</p>
          </div>
          {logoUploading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (file.size > 5 * 1024 * 1024) {
              alert('Picha ni kubwa mno. Tafadhali chagua picha chini ya 5MB.')
              return
            }
            setLogoPreview(URL.createObjectURL(file))
            setLogoUploading(true)
            const formData = new FormData()
            formData.append('file', file)
            try {
              await apiClient.post('/api/v1/knowledge/shop-logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              })
              queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
            } catch {
              alert('Imeshindwa kupakia picha. Tafadhali jaribu tena.')
              setLogoPreview(null)
            } finally {
              setLogoUploading(false)
            }
          }}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Business Description */}
        <SectionCard
          icon={FileText}
          title="Maelezo ya Biashara"
          description="AI yako inatumia haya kujitambulisha kwa wateja kwa njia ya kawaida."
        >
          <textarea
            {...register('business_description')}
            rows={3}
            placeholder="e.g. Tunauza bidhaa za umeme na vifaa vya ujenzi. Tuko Mwanza mjini na tunafanya delivery ndani ya jiji."
            className={`${inputCls} resize-none`}
          />
        </SectionCard>

        {/* Business Hours */}
        <SectionCard icon={Clock} title="Masaa ya Kufanya Kazi">
        <label className="flex items-center gap-2.5 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={isOpen24h}
            onChange={e => setIsOpen24h(e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-500"
          />
          <span className="text-sm text-gray-300">Tunafanya kazi saa 24 (hatufungi)</span>
        </label>

        <div className={`grid grid-cols-2 gap-4 transition-opacity ${isOpen24h ? 'opacity-40 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Saa ya Kufungua</label>
            <input
              {...register('opening_time')}
              type="time"
              disabled={isOpen24h}
              className={`${inputCls} scheme-dark`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Saa ya Kufunga</label>
            <input
              {...register('closing_time')}
              type="time"
              disabled={isOpen24h}
              className={`${inputCls} scheme-dark`}
            />
          </div>
        </div>
      </SectionCard>
        {/* Location */}
        <SectionCard
          icon={MapPin}
          title="Mahali Biashara Ilipo"
          description="AI inashiriki hii pale mteja anapouliza 'mko wapi?'"
        >
          <input
            {...register('location')}
            placeholder="e.g. Mwanza mjini, karibu na Pasaka Malls, ghorofa ya pili"
            className={inputCls}
          />
          {errors.location && <p className="mt-1 text-xs text-red-400">{errors.location.message}</p>}
        </SectionCard>

        {/* Contact */}
        <SectionCard
          icon={Phone}
          title="Namba ya Mawasiliano"
          description="Inashirikiwa pale mteja anapotaka kuongea na mtu halisi."
        >
          <input {...register('contact_phone')} type="tel" placeholder="e.g. 0712 345 678" className={inputCls} />
          {errors.contact_phone && <p className="mt-1 text-xs text-red-400">{errors.contact_phone.message}</p>}
        </SectionCard>

        {/* Website */}
        <SectionCard
          icon={Globe}
          title="Website"
          description="AI inaweza kupakua taarifa za moja kwa moja kutoka website yako pale mteja anapouliza vitu visivyokuwa kwenye knowledge base."
        >
          <input
            {...register('website_url')}
            type="url"
            placeholder="https://mybusiness.co.tz"
            className={inputCls}
          />
        </SectionCard>

        {/* Delivery Zones */}
        <SectionCard
          icon={Truck}
          title="Maeneo na Bei za Delivery"
          description="AI inatumia hii kujibu maswali ya delivery. Eneo moja kwa kila mstari."
        >
          <textarea
            {...register('delivery_zones')}
            rows={4}
            placeholder={`Mwanza Mjini - 3,000 TZS\nIlemela - 5,000 TZS\nNyamagana - 4,000 TZS`}
            className={`${inputCls} resize-none`}
          />
          <p className="mt-1 text-xs text-gray-500">Mfumo: Jina la Eneo - Bei (mstari mmoja kwa kila eneo)</p>
        </SectionCard>

        {/* Save */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-sm">
            {saveStatus === 'saved' && <span className="text-indigo-400 font-medium">✓ Mipangilio imehifadhiwa</span>}
            {saveStatus === 'error' && <span className="text-red-400 font-medium">Imeshindwa — jaribu tena.</span>}
          </div>
          <button
            type="submit"
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveStatus === 'saving' ? 'Inahifadhi…' : 'Hifadhi Mipangilio'}
          </button>
        </div>
      </form>


      {/* Customer Notice */}
      <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Notisi kwa Wateja</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Tahadhari inayoonekana kwa kila mteja anapofungua chati yako. AI pia itaitumia kwenye mazungumzo. Acha wazi ili kuondoa.
            </p>
          </div>
        </div>

        {notice && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-amber-400 text-sm mt-0.5 shrink-0">⚠️</span>
            <p className="text-amber-300 text-xs leading-relaxed">{notice}</p>
          </div>
        )}

        <div>
          <textarea
            value={notice}
            onChange={e => setNotice(e.target.value.slice(0, 500))}
            rows={3}
            placeholder='e.g. "Duka limefungwa Jumamosi na Jumapili. Tunarudi Jumatatu."'
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none transition"
            maxLength={500}
          />
          <div className="flex items-center justify-between mt-1">
            <p className={`text-xs ${notice.length > 250 ? 'text-amber-400' : 'text-gray-600'}`}>
              herufi {notice.length}/500
            </p>
            {noticeData?.notice && !notice && (
              <p className="text-xs text-gray-500">Wazi = notisi itaondolewa kwenye chati</p>
            )}
          </div>
        </div>

          <div className="flex items-center justify-between gap-3">
          <div className="text-xs">
            {noticeSaving === 'saved' && <span className="text-amber-400 font-medium">✓ Notisi imesasishwa</span>}
            {noticeSaving === 'error' && <span className="text-red-400">Imeshindwa — jaribu tena</span>}
          </div>
          <div className="flex items-center gap-2">
            {/* Remove button — only visible when a notice is saved on server */}
            {noticeData?.notice && (
              <button
                onClick={async () => {
                  setNoticeSaving('saving')
                  try {
                    await apiClient.post('/api/v1/knowledge/shop-notice', { notice: '' })
                    setNotice('')
                    await queryClient.invalidateQueries({ queryKey: ['shop-notice'] })
                    setNoticeSaving('saved')
                    setTimeout(() => setNoticeSaving('idle'), 3000)
                  } catch {
                    setNoticeSaving('error')
                    setTimeout(() => setNoticeSaving('idle'), 4000)
                  }
                }}
                disabled={noticeSaving === 'saving'}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-2 text-sm font-semibold text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2Icon className="w-3.5 h-3.5" />
                Futa
              </button>
            )}

            {/* Save/update button — only for creating or updating content */}
            <button
              onClick={async () => {
                if (!notice.trim()) return
                setNoticeSaving('saving')
                try {
                  await apiClient.post('/api/v1/knowledge/shop-notice', { notice })
                  await queryClient.invalidateQueries({ queryKey: ['shop-notice'] })
                  setNoticeSaving('saved')
                  setTimeout(() => setNoticeSaving('idle'), 3000)
                } catch {
                  setNoticeSaving('error')
                  setTimeout(() => setNoticeSaving('idle'), 4000)
                }
              }}
              disabled={noticeSaving === 'saving' || !notice.trim()}
              className="flex items-center gap-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-4 py-2 text-sm font-semibold text-amber-400 transition-colors disabled:opacity-50"
            >
              {noticeSaving === 'saving'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Bell className="w-3.5 h-3.5" />
              }
              {noticeSaving === 'saving'
                ? 'Inahifadhi…'
                : noticeData?.notice
                ? 'Sasisha Notisi'
                : 'Tengeneza Notisi'
              }
            </button>
          </div>
        </div>
      </div>

      {/* AI Model — read-only, subscription-driven */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">AI Model</h2>
            {hasSubscription ? (
              <p className="text-xs text-gray-400 mt-0.5">
                Mpango wako wa <span className="text-indigo-400 font-medium capitalize">{subscription.plan_id}</span> unatumia{' '}
                <span className="text-white font-medium">
                  {subscription.plan_id === 'pro' ? '🧠 Smart Mode' : '⚡ Eco Mode'}
                </span>.
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                Huna mpango. Chagua mpango kwenye Billing ili AI yako iwezeshwe.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chat Link & QR */}
      {chatLink && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <div className="flex flex-col lg:flex-row items-center gap-8">

            {/* Left: branding + copy link */}
            <div className="flex-1 w-full lg:order-1 space-y-4 text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                {tenantData?.user?.logo_url ? (
                  <img src={tenantData.user.logo_url} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                    <span className="text-indigo-400 font-bold text-lg">
                      {(tenantData?.user?.business_name ?? 'W')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold text-base">{tenantData?.user?.business_name}</p>
                  <p className="text-gray-500 text-xs">Chati nasi hapa</p>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto lg:mx-0">
                Wateja wako wanaweza kuchati na AI yako papo hapo — kupitia link au kwa kuscan QR code.
              </p>

              <div className="flex items-center gap-2 max-w-sm mx-auto lg:mx-0">
                <div className="flex-1 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 min-w-0">
                  <Link2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="text-sm text-indigo-300 truncate">{chatLink}</span>
                </div>
                <button type="button" onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Imenakiliwa!</> : <><Copy className="w-3.5 h-3.5" /> Nakili</>}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadQR}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors mx-auto lg:mx-0"
              >
                <QrCode className="w-4 h-4" /> Pakua QR Code
              </button>
            </div>

          </div>
        </div>
      )}


      {chatLink && <TestBotPanel chatLink={chatLink} />}

      
    </div>
  )
}


function TestBotPanel({ chatLink }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Jaribu Bot Yako</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ona jinsi wateja wanavyoona bot yako, papo hapo.</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors shrink-0"
          >
            Jaribu Sasa
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <p className="text-sm font-semibold text-white">Jaribu Bot Yako</p>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <iframe
            src={chatLink}
            className="flex-1 w-full border-none"
            title="Test Bot"
          />
        </div>
      )}
    </>
  )
}