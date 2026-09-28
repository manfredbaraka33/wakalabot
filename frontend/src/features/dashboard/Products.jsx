import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Loader2, Package, Wrench,
  ToggleLeft, ToggleRight, X, ImagePlus, XCircle,
} from 'lucide-react'
import apiClient from '../../api/axios'

const inputCls =
  'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition'

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchProducts() {
  const res = await apiClient.get('/api/v1/products')
  return res.data
}

async function saveProduct(data) {
  const form = new FormData()
  form.append('name', data.name)
  form.append('category', data.category)
  form.append('description', data.description || '')
  form.append('stock_quantity', data.stock_quantity ?? 0)

  if (data.useRange) {
    form.append('price', 0)
    form.append('price_min', data.price_min)
    form.append('price_max', data.price_max)
  } else {
    form.append('price', data.price)
    form.append('price_min', '')
    form.append('price_max', '')
  }

  // Images
  if (data.imageFile) form.append('image', data.imageFile)
  else if (data.existing_image_url) form.append('existing_image_url', data.existing_image_url)

  if (data.imageFile2) form.append('image2', data.imageFile2)
  if (data.imageFile3) form.append('image3', data.imageFile3)
  if (data.existing_extra_images) {
    form.append('existing_extra_images', JSON.stringify(data.existing_extra_images))
  }

  if (data.id) {
    const res = await apiClient.put(`/api/v1/products/${data.id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  }
  const res = await apiClient.post('/api/v1/products', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ── Image Upload Box ──────────────────────────────────────────────────────────

function ImageBox({ label, preview, onChange, onRemove }) {
  return (
    <div className="relative">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <div
        onClick={() => document.getElementById(`img-${label}`)?.click()}
        className={`w-full h-24 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-colors ${
          preview
            ? 'border-indigo-500/30'
            : 'border-gray-700 hover:border-indigo-500/50'
        }`}
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-600">
            <ImagePlus className="w-5 h-5" />
            <span className="text-xs">Pakia picha</span>
          </div>
        )}
      </div>
      {preview && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5"
        >
          <XCircle className="w-3.5 h-3.5 text-white" />
        </button>
      )}
      <input
        id={`img-${label}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          if (file.size > 5 * 1024 * 1024) {
            alert('Picha ni kubwa mno. Max 5MB.')
            return
          }
          onChange(file)
        }}
      />
    </div>
  )
}

// ── Product Modal ─────────────────────────────────────────────────────────────

function ProductModal({ product, onClose, onSave, isSaving, errorMessage }) {
  const isEdit = !!product?.id
  // Use all_images (backend-assembled list) as source of truth for previews
  const allImgs = product?.all_images || []
  const extraImgs = product?.extra_images || []

  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'product',
    description: product?.description || '',
    stock_quantity: product?.stock_quantity ?? 0,
    price: product?.has_price_range ? '' : (product?.price || ''),
    price_min: product?.price_min || '',
    price_max: product?.price_max || '',
    useRange: product?.has_price_range || false,
    existing_image_url: product?.image_url || null,
    existing_extra_images: extraImgs,
    imageFile: null,
    imageFile2: null,
    imageFile3: null,
    // previews sourced from all_images for reliability
    preview1: allImgs[0] || null,
    preview2: allImgs[1] || null,
    preview3: allImgs[2] || null,
  })
  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    if (form.useRange) {
      if (!form.price_min || !form.price_max) {
        alert('Weka bei ya chini na bei ya juu.')
        return
      }
      if (Number(form.price_min) >= Number(form.price_max)) {
        alert('Bei ya chini lazima iwe ndogo kuliko bei ya juu.')
        return
      }
    } else {
      if (!form.price) {
        alert('Weka bei ya bidhaa.')
        return
      }
    }
    onSave({ ...form, id: product?.id })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 shrink-0">
          <h3 className="font-semibold text-white">
            {isEdit ? 'Hariri Bidhaa' : 'Ongeza Bidhaa Mpya'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Category */}
          <div className="flex gap-2">
            {['product', 'service'].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => set('category', cat)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.category === cat
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {cat === 'product' ? '📦 Bidhaa' : '🔧 Huduma'}
              </button>
            ))}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Jina</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Samsung Galaxy A15"
              className={inputCls}
              required
            />
          </div>

          {/* Price toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-400">Bei</label>
              <button
                type="button"
                onClick={() => set('useRange', !form.useRange)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  form.useRange
                    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                    : 'border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                {form.useRange ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                Bei ya Kadirio
              </button>
            </div>

            {form.useRange ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bei ya Chini (TZS)</label>
                  <input
                    type="number"
                    value={form.price_min}
                    onChange={e => set('price_min', e.target.value)}
                    placeholder="33,000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bei ya Juu (TZS)</label>
                  <input
                    type="number"
                    value={form.price_max}
                    onChange={e => set('price_max', e.target.value)}
                    placeholder="65,000"
                    className={inputCls}
                  />
                </div>
                {form.price_min && form.price_max && (
                  <div className="col-span-2 text-xs text-indigo-400 bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-3 py-2">
                    Itaonekana kwa wateja: {Number(form.price_min).toLocaleString()}–{Number(form.price_max).toLocaleString()} TZS
                  </div>
                )}
              </div>
            ) : (
              <input
                type="number"
                value={form.price}
                onChange={e => set('price', e.target.value)}
                placeholder="Bei maalum (TZS)"
                className={inputCls}
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Maelezo</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Maelezo ya bidhaa — rangi, ukubwa, kitu kingine mteja angehitaji kujua"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Stock — only for products */}
          {form.category === 'product' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Idadi iliyopo (Stock)
              </label>
              <input
                type="number"
                // min={0}
                value={form.stock_quantity}
                onChange={e => set('stock_quantity', parseInt(e.target.value))}
                placeholder='e.g 78'
                className={inputCls}
              />
            </div>
          )}

          {/* Images */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Picha (hadi 3)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <ImageBox
                label="Kuu"
                preview={form.preview1}
                onChange={file => {
                  set('imageFile', file)
                  set('preview1', URL.createObjectURL(file))
                  set('existing_image_url', null)
                }}
                onRemove={() => {
                  set('imageFile', null)
                  set('preview1', null)
                  set('existing_image_url', null)
                }}
              />
              <ImageBox
                label="2"
                preview={form.preview2}
                onChange={file => {
                  set('imageFile2', file)
                  set('preview2', URL.createObjectURL(file))
                  const extras = [...(form.existing_extra_images || [])]
                  if (extras.length > 0) extras[0] = null
                  set('existing_extra_images', extras)
                }}
                onRemove={() => {
                  set('imageFile2', null)
                  set('preview2', null)
                  const extras = [...(form.existing_extra_images || [])]
                  if (extras.length > 0) extras.splice(0, 1)
                  set('existing_extra_images', extras)
                }}
              />
              <ImageBox
                label="3"
                preview={form.preview3}
                onChange={file => {
                  set('imageFile3', file)
                  set('preview3', URL.createObjectURL(file))
                  const extras = [...(form.existing_extra_images || [])]
                  if (extras.length > 1) extras[1] = null
                  set('existing_extra_images', extras)
                }}
                onRemove={() => {
                  set('imageFile3', null)
                  set('preview3', null)
                  const extras = [...(form.existing_extra_images || [])]
                  if (extras.length > 1) extras.splice(1, 1)
                  set('existing_extra_images', extras)
                }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">
              JPEG, PNG au WebP. Max 5MB kila moja.
            </p>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition-colors"
          >
            Ghairi
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSaving ? 'Inahifadhi…' : isEdit ? 'Hifadhi Mabadiliko' : 'Ongeza'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Products() {
  const qc = useQueryClient()
  const [editTarget, setEditTarget] = useState(null)
  const [tab, setTab] = useState('product')

  const { data: products = [], isLoading } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  select: (data) => data?.products || [], 
})

  // Add these two logs:
  console.log('📦 Raw products data from React Query:', products)
  if (Array.isArray(products) && products.length > 0) {
    console.log('🖼️ First item structure:', products[0])
  }

  const saveMutation = useMutation({
    mutationFn: saveProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/api/v1/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/api/v1/products/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  
  const filtered = Array.isArray(products) 
  ? products.filter(p => p.category === tab) 
  : []

  const saveError = saveMutation.error
  const saveErrorMessage = saveError?.response?.data?.detail ||
    (saveError?.response?.status === 413
      ? 'Picha ni kubwa mno. Tafadhali chagua picha chini ya 5MB.'
      : saveError ? 'Imeshindwa kuhifadhi. Tafadhali jaribu tena.' : null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bidhaa na Huduma</h1>
          <p className="text-sm text-gray-400 mt-1">
            Bidhaa unazoweka hapa ndizo AI yako inazojua na kujibu wateja.
          </p>
        </div>
        <button
          onClick={() => setEditTarget({})}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Ongeza
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-2">
        {[
          { key: 'product', label: '📦 Bidhaa', icon: Package },
          { key: 'service', label: '🔧 Huduma', icon: Wrench },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              tab === t.key
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Inapakia...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 py-16 text-center text-gray-500">
          <p className="text-sm">Bado hamna {tab === 'product' ? 'bidhaa' : 'huduma'}.</p>
          <button
            onClick={() => setEditTarget({})}
            className="mt-3 text-xs text-indigo-400 hover:underline"
          >
            Ongeza ya kwanza →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
                p.is_active ? 'border-gray-800' : 'border-gray-800/40 opacity-50'
              }`}
            >
              {/* Image Section */}
              {p.image_url ? (
                <div className="h-36 bg-gray-800">
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={e => {
                      // Fallback if Cloudinary link ever breaks
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              ) : (
                <div className="h-36 bg-gray-800 flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-700" />
                </div>
              )}

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white font-semibold text-sm leading-tight">{p.name}</p>
                  <button
                    onClick={() => toggleMutation.mutate(p.id)}
                    className="shrink-0 text-gray-500 hover:text-white transition-colors"
                    title={p.is_active ? 'Zima' : 'Washa'}
                  >
                    {p.is_active
                      ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                      : <ToggleLeft className="w-4 h-4" />
                    }
                  </button>
                </div>

                <p className="text-indigo-400 text-sm font-bold">{p.price_display}</p>

                {p.description && (
                  <p className="text-gray-500 text-xs line-clamp-2">{p.description}</p>
                )}

                {p.category === 'product' && (
                  <p className={`text-xs font-medium ${
                    p.stock_quantity > 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {p.stock_quantity > 0 ? `Stock: ${p.stock_quantity}` : 'Imeisha'}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setEditTarget(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 py-1.5 text-xs text-gray-300 hover:border-indigo-500 hover:text-white transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Hariri
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Futa "${p.name}"?`)) deleteMutation.mutate(p.id)
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 py-1.5 px-3 text-xs text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editTarget !== null && (
        <ProductModal
          product={editTarget?.id ? editTarget : null}
          onClose={() => { setEditTarget(null); saveMutation.reset() }}
          onSave={data => saveMutation.mutate(data)}
          isSaving={saveMutation.isPending}
          errorMessage={saveErrorMessage}
        />
      )}
    </div>
  )
}