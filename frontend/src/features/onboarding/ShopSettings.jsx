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
  opening_time: z.string().min(1),
  closing_time: z.string().min(1),
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

function CoinMathModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="text-base font-semibold text-white">How coins are calculated</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-300">
          <p>Coins are deducted based on exact tokens used per AI call.</p>
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">1 average message =</p>
            <p>Up to <span className="text-white font-semibold">100 words total</span> — customer input + AI reply.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
              <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">Eco Mode (gemini-3.1-flash-lite)</p>
                <p className="text-gray-400 text-xs">≈ <span className="text-yellow-400 font-medium">3 coins</span> per average message</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
              <Brain className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <p className="text-white text-xs font-semibold">Smart Mode (gemini-3.5-flash)</p>
                <p className="text-gray-400 text-xs">≈ <span className="text-indigo-400 font-medium">25 coins</span> per average message</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 border-t border-gray-800 pt-3">
            Note: if you have an active monthly subscription, your AI model is fixed by your plan
            and coin deduction does not apply until your monthly message allowance is used up.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ShopSettings() {
  const [saveStatus, setSaveStatus] = useState('idle')
  const [copied, setCopied] = useState(false)
  const [copiedWidget, setCopiedWidget] = useState(false)
  const [aiModeSaving, setAiModeSaving] = useState(false)
  const [aiModeSaved, setAiModeSaved] = useState(false)
  const [showCoinModal, setShowCoinModal] = useState(false)
  const queryClient = useQueryClient()
  const qrRef = useRef(null)

  const [notice, setNotice] = useState('')
  const [noticeSaving, setNoticeSaving] = useState('idle')

  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef(null)


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

  const hasSubscription = !!subscription?.has_subscription
  const activeAiMode = hasSubscription
    ? (subscription.plan_id === 'pro' ? 'smart' : 'eco')
    : (tenantData?.user?.ai_mode || 'eco')

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    values: {
      opening_time: existing?.opening_time ?? '08:00',
      closing_time: existing?.closing_time ?? '18:00',
      location: existing?.location ?? '',
      contact_phone: existing?.contact_phone ?? '',
      website_url: existing?.website_url ?? '',
      delivery_zones: existing?.delivery_zones ?? '',
      business_description: existing?.business_description ?? '',
    },
  })

  async function onSubmit(data) {
    setSaveStatus('saving')
    try {
      await apiClient.post('/api/v1/knowledge/shop-settings', data)
      queryClient.invalidateQueries({ queryKey: ['shop-settings'] })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 4000)
    }
  }

  async function saveAiMode(mode) {
    if (hasSubscription) return // locked — plan dictates model, never client-toggleable

    setAiModeSaving(true)
    const previousData = queryClient.getQueryData(['tenant-info'])

    queryClient.setQueryData(['tenant-info'], (oldData) => {
      if (!oldData) return { user: { ai_mode: mode } }
      return { ...oldData, user: { ...oldData.user, ai_mode: mode } }
    })

    try {
      await apiClient.patch('/api/v1/auth/ai-mode', { ai_mode: mode })
      queryClient.setQueryData(['tenant-info'], (oldData) => {
        return { ...oldData, user: { ...oldData.user, ai_mode: mode } }
      })
      setAiModeSaved(true)
      setTimeout(() => setAiModeSaved(false), 3000)
    } catch (error) {
      if (previousData) {
        queryClient.setQueryData(['tenant-info'], previousData)
      }
      alert('Failed to update AI model. Please try again.')
    } finally {
      setAiModeSaving(false)
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



  function handleDownloadQR() {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    // 1. Clone the SVG so we don't alter the one currently displaying on your website
    const clonedSvg = svg.cloneNode(true)

    // 2. Grab the current width and height to build a viewBox (if it's missing)
    const currentWidth = clonedSvg.getAttribute('width') || '256'
    const currentHeight = clonedSvg.getAttribute('height') || '256'
    if (!clonedSvg.getAttribute('viewBox')) {
      clonedSvg.setAttribute('viewBox', `0 0 ${currentWidth} ${currentHeight}`)
    }

    // 3. Force the SVG canvas to be 100% of the window and center the contents
    clonedSvg.setAttribute('width', '100%')
    clonedSvg.setAttribute('height', '100%')
    clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')


    // 4. Convert to string and download
    const svgData = new XMLSerializer().serializeToString(clonedSvg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-qrcode.svg`
    a.click()
    URL.revokeObjectURL(url)
  }



 




  if (isLoading) return (
    <div className="flex items-center justify-center py-16 text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Shop Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure your AI agent with accurate business information.
        </p>
      </div>

      {/* Business Logo */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Business Logo</h2>
            <p className="text-xs text-gray-400 mt-0.5">Appears in chat headers and the widget. Square images work best.</p>
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
              {tenantData?.user?.logo_url ? 'Change Logo' : 'Upload Logo'}
            </button>
            {tenantData?.user?.logo_url && (
              <button
                type="button"
                // onClick={async () => {
                //   await apiClient.delete('/api/v1/knowledge/shop-logo')
                //   queryClient.invalidateQueries({ queryKey: ['tenant-info'] })
                //   setLogoPreview(null)
                // }}
                onClick={async () => {
                    try {
                      await apiClient.delete('/api/v1/knowledge/shop-logo');
                      queryClient.invalidateQueries({ queryKey: ['tenant-info'] });
                      setLogoPreview(null);
                    } catch (error) {
                      // This will print exactly what FastAPI is complaining about!
                      // console.error("FastAPI Error Detail:", error.response?.data); 
                      alert("Logo upload failed")
                    }
                  }}
                className="text-sm text-red-400 hover:text-red-300 font-medium block"
              >
                Remove Logo
              </button>
            )}
            <p className="text-xs text-gray-600">JPEG, PNG or WebP. Max 5MB.</p>
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
          title="Business Description"
          description="Your AI agent uses this to introduce your business naturally to customers."
        >
          <textarea
            {...register('business_description')}
            rows={3}
            placeholder="e.g. Tunauza bidhaa za umeme na vifaa vya ujenzi. Tuko Mwanza mjini na tunafanya delivery ndani ya jiji."
            className={`${inputCls} resize-none`}
          />
        </SectionCard>

        {/* Business Hours */}
        <SectionCard
          icon={Clock}
          title="Business Hours"
          description="Agent uses these to answer 'mnafungua saa ngapi?'"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Opening Time</label>
              <input {...register('opening_time')} type="time" className={`${inputCls} scheme-dark`} />
              {errors.opening_time && <p className="mt-1 text-xs text-red-400">{errors.opening_time.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Closing Time</label>
              <input {...register('closing_time')} type="time" className={`${inputCls} scheme-dark`} />
              {errors.closing_time && <p className="mt-1 text-xs text-red-400">{errors.closing_time.message}</p>}
            </div>
          </div>
        </SectionCard>

        {/* Location */}
        <SectionCard
          icon={MapPin}
          title="Business Location"
          description="Agent shares this when customers ask 'mko wapi?'"
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
          title="Contact Phone"
          description="Shared when customers want to speak to a real person."
        >
          <input {...register('contact_phone')} type="tel" placeholder="e.g. 0712 345 678" className={inputCls} />
          {errors.contact_phone && <p className="mt-1 text-xs text-red-400">{errors.contact_phone.message}</p>}
        </SectionCard>

        {/* Website */}
        <SectionCard
          icon={Globe}
          title="Business Website"
          description="Agent can fetch live info from your website when customers ask about things not in your knowledge base."
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
          title="Delivery Zones & Costs"
          description="Agent uses this to answer delivery questions. One zone per line."
        >
          <textarea
            {...register('delivery_zones')}
            rows={4}
            placeholder={`Mwanza Mjini - 3,000 TZS\nIlemela - 5,000 TZS\nNyamagana - 4,000 TZS`}
            className={`${inputCls} resize-none`}
          />
          <p className="mt-1 text-xs text-gray-500">Format: Zone Name - Price (one per line)</p>
        </SectionCard>

        {/* Save */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-sm">
            {saveStatus === 'saved' && <span className="text-indigo-400 font-medium">✓ Settings saved</span>}
            {saveStatus === 'error' && <span className="text-red-400 font-medium">Failed — try again.</span>}
          </div>
          <button
            type="submit"
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveStatus === 'saving' ? 'Saving…' : 'Save Settings'}
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
            <h2 className="text-base font-semibold text-white">Customer Notice</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              A pinned alert shown to every customer who opens your chat. The AI will also reference it in conversations. Leave blank to remove.
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
            onChange={e => setNotice(e.target.value.slice(0, 280))}
            rows={3}
            placeholder='e.g. "Duka limefungwa Jumamosi na Jumapili. Tunarudi Jumatatu."'
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none transition"
            maxLength={280}
          />
          <div className="flex items-center justify-between mt-1">
            <p className={`text-xs ${notice.length > 250 ? 'text-amber-400' : 'text-gray-600'}`}>
              {notice.length}/280 characters
            </p>
            {noticeData?.notice && !notice && (
              <p className="text-xs text-gray-500">Empty = notice removed from chat</p>
            )}
          </div>
        </div>

          <div className="flex items-center justify-between gap-3">
          <div className="text-xs">
            {noticeSaving === 'saved' && <span className="text-amber-400 font-medium">✓ Notice updated</span>}
            {noticeSaving === 'error' && <span className="text-red-400">Failed — try again</span>}
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
                Remove
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
                ? 'Saving…'
                : noticeData?.notice
                ? 'Update Notice'
                : 'Create Notice'
              }
            </button>
          </div>
        </div>
      </div>



      {/* AI Model Selector */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Select Your AI Model</h2>
            {hasSubscription ? (
              <p className="text-xs text-gray-400 mt-0.5">
                Una mpango wa <span className="text-indigo-400 font-medium capitalize">{subscription.plan_id}</span> —
                mfumo wa AI umewekwa kiotomatiki kulingana na mpango wako. Chaguo hapa chini halitatumika ukiwa na mpango.
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                Choose how smart and how expensive your assistant is.{' '}
                <button type="button" onClick={() => setShowCoinModal(true)} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                  Learn how this is calculated
                </button>
              </p>
            )}
          </div>
        </div>

        {hasSubscription && (
          <div className="flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <p className="text-xs text-indigo-300">
              Locked by your {subscription.plan_id} subscription
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            disabled={hasSubscription}
            onClick={() => saveAiMode('eco')}
            className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
              hasSubscription ? 'opacity-40 cursor-not-allowed' : ''
            } ${
              activeAiMode === 'eco' ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${activeAiMode === 'eco' ? 'border-yellow-400' : 'border-gray-600'}`}>
              {activeAiMode === 'eco' && <div className="w-2 h-2 rounded-full bg-yellow-400" />}
            </div>
            <Zap className={`w-5 h-5 shrink-0 ${activeAiMode === 'eco' ? 'text-yellow-400' : 'text-gray-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">⚡ Eco Mode</p>
              <p className="text-xs text-gray-400 mt-0.5">Costs less coins</p>
            </div>
          </button>
          <button
            type="button"
            disabled={hasSubscription}
            onClick={() => saveAiMode('smart')}
            className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
              hasSubscription ? 'opacity-40 cursor-not-allowed' : ''
            } ${
              activeAiMode === 'smart' ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-gray-700 bg-gray-800 hover:border-gray-600'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${activeAiMode === 'smart' ? 'border-indigo-400' : 'border-gray-600'}`}>
              {activeAiMode === 'smart' && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
            </div>
            <Brain className={`w-5 h-5 shrink-0 ${activeAiMode === 'smart' ? 'text-indigo-400' : 'text-gray-500'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">🧠 Smart Mode</p>
              <p className="text-xs text-gray-400 mt-0.5">Costs more coins, but smarter</p>
            </div>
          </button>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 h-4">
          {aiModeSaving && <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>}
          {aiModeSaved && <span className="text-indigo-400">✓ Model updated</span>}
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
                  {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadQR}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors mx-auto lg:mx-0"
              >
                <QrCode className="w-4 h-4" /> Download QR Code
              </button>
            </div>

            {/* Right: large centered QR, the visual hero */}
            <div className="lg:order-2 shrink-0">
              <div className="relative">
                <div ref={qrRef} className="bg-white p-6 rounded-2xl shadow-2xl inline-block">
                  <QRCodeSVG
                    value={chatLink}
                    size={220}
                    bgColor="#ffffff"
                    fgColor="#1e1b4b"
                    level="H"
                    imageSettings={
                      tenantData?.user?.logo_url
                        ? {
                            src: tenantData.user.logo_url,
                            height: 40,
                            width: 40,
                            excavate: true,
                          }
                        : undefined
                    }
                  />
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                  Scan & Chat
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Embeddable Widget */}
      {slug && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
              <Code className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Embeddable Widget</h2>
              <p className="text-xs text-gray-400 mt-0.5">Paste into any website to add a floating chat button.</p>
            </div>
          </div>
          <div className="bg-gray-950 border border-gray-700 rounded-lg p-4 relative">
            <pre className="text-xs text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {`<script
              src="${baseUrl}/widget.js"
              data-slug="${slug}"
            ></script>`}
            </pre>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`<script\n  src="${baseUrl}/widget.js"\n  data-slug="${slug}"\n></script>`)
                setCopiedWidget(true)
                setTimeout(() => setCopiedWidget(false), 2500)
              }}
              className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-indigo-500 px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white transition-colors"
            >
              {copiedWidget ? <><Check className="w-3 h-3 text-emerald-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
        </div>
      )}

      {showCoinModal && <CoinMathModal onClose={() => setShowCoinModal(false)} />}
    </div>
  )
}