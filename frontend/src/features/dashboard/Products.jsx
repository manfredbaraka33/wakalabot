import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, X, Check, Loader2, Package,
  ImageOff, ChevronUp, ChevronDown,
} from 'lucide-react'
import { productsApi } from '../../api/products'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(price) {
  return Number(price).toLocaleString('en-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  })
}

const EMPTY_FORM = {
  name: '', description: '', price: '', stock_quantity: '', is_active: true,category: 'product'
}

// ── Product form modal (create / edit) ───────────────────────────────────────
function ProductModal({ product, onClose, onSave, isSaving,errorMessage }) {
  const isNew = !product
  const [form, setForm] = useState(
    isNew
      ? EMPTY_FORM
      : {
          name: product.name,
          description: product.description,
          price: String(product.price),
          stock_quantity: String(product.stock_quantity),
          category: product.category || 'product',
          is_active: product.is_active,
        }
  )
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(
    isNew ? null : (product.image_url ?? null)
  )
  const fileInputRef = useRef(null)

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price) || 0,
      stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      category: form.category,
      is_active: form.is_active,
      imageFile: imageFile ?? undefined,
    })
  }

  const labelCls = 'block text-xs font-medium text-gray-400 mb-1'
  const inputCls =
    'w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4 shrink-0">
          <h3 className="text-base font-semibold text-white">
            {isNew ? 'Ongeza Bidhaa' : 'Hariri Bidhaa'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="product-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div>
            <label className={labelCls}>Item Type *</label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={inputCls}
            >
              <option value="product">Bidhaa</option>
              <option value="service">Huduma</option>
            </select>
          </div>
          
          <div>
            <label className={labelCls}>Jina la bidhaa/huduma *</label>
            <input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Unga wa Ngano 2kg"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Maelezo muhimu kuhusu bidhaa au huduma...."
              className={`${inputCls} resize-none`}
            />
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Price (TZS) *</label>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="2500"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Kiwango(idadi ya bidhaa zilizopo/zinazopatikana) *</label>
              {form.category === 'service' ? (
                <div className="w-full rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2 text-sm text-gray-500 select-none">
                  Hahiitajiki
                </div>
              ) : (
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock_quantity}
                  onChange={(e) => set('stock_quantity', e.target.value)}
                  placeholder="50"
                  className={inputCls}
                />
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Picha (hiari)</label>
            {/* Preview */}
            {imagePreview && (
              <div className="relative mb-2 w-full h-40 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageFile(null) }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* File input */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 cursor-pointer rounded-lg bg-gray-800 border border-dashed border-gray-600 px-3 py-3 hover:border-[#6366f1] transition-colors"
            >
              <ImageOff className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-400 truncate">
                {imageFile ? imageFile.name : 'Click to upload image (JPEG, PNG, WebP)'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.size > 5 * 1024 * 1024) {
                  alert('Picha ni kubwa mno. Tafadhali chagua picha chini ya 5MB.')
                  e.target.value = ''
                  return
                }
                setImageFile(file)
                setImagePreview(URL.createObjectURL(file))
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                form.is_active ? 'bg-[#6366f1]' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  form.is_active ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-gray-400">
              {form.is_active ? 'Active (visible to AI)' : 'Inactive (hidden from AI)'}
            </span>
          </div>
        </form>

        {/* Footer */}
        <div className="flex flex-col gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
          {errorMessage && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}
          <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Ghairi
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-[#20bd59] disabled:opacity-60 transition-colors"
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{isNew ? 'Saving…' : 'Updating…'}</>
            ) : (
              <><Check className="w-4 h-4" />{isNew ? 'Save' : 'Update'}</>
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

// ── Stock adjustment cell ─────────────────────────────────────────────────────
function StockCell({ product, onAdjust, isUpdating }) {
  const [delta, setDelta] = useState('')

  function apply(sign) {
    const n = parseInt(delta, 10)
    if (!n || n <= 0) return
    const newQty = Math.max(0, product.stock_quantity + sign * n)
    onAdjust(product.id, { stock_quantity: newQty })
    setDelta('')
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-sm font-semibold ${
          product.stock_quantity === 0
            ? 'text-red-400'
            : product.stock_quantity < 5
            ? 'text-yellow-400'
            : 'text-white'
        }`}
      >
        {product.stock_quantity}
      </span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="1"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="qty"
          className="w-14 rounded bg-gray-800 border border-gray-700 px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-[#6366f1]"
        />
        <button
          onClick={() => apply(1)}
          disabled={isUpdating}
          title="Add stock"
          className="w-5 h-5 rounded bg-green-500/15 hover:bg-green-500/30 text-green-400 flex items-center justify-center transition-colors disabled:opacity-40"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          onClick={() => apply(-1)}
          disabled={isUpdating}
          title="Remove stock"
          className="w-5 h-5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-colors disabled:opacity-40"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteModal({ name, onClose, onConfirm, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Futa "{name}"?</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Itaondolewa kwenye Maudhui ya biashara(Knowledge base)
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Ghairi
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition-colors"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Futa
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Products() {
  const queryClient = useQueryClient()
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)


  const { data, isLoading, isError } = useQuery({
  queryKey: ['products'],
  queryFn: async () => {
    const result = await productsApi.list()
    console.log('Products API response:', result)
    return result
  },
})


  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setEditTarget(null)
    },
    onError: () => {}, // handled via isError below, modal stays open so user can retry
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setEditTarget(null)
    },
    onError: () => {},
  })

  const saveError = createMutation.error || updateMutation.error
  const saveErrorMessage =
    saveError?.response?.data?.detail ||
    (saveError?.response?.status === 413
      ? 'Picha ni kubwa mno. Tafadhali chagua picha chini ya 5MB.'
      : saveError
      ? 'Imeshindwa kuhifadhi. Tafadhali jaribu tena.'
      : null)

  const deleteMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setDeleteTarget(null)
    },
  })

  function handleSave(formData) {
    if (editTarget?.id) {
      updateMutation.mutate({ id: editTarget.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  function handleStockAdjust(id, data) {
    updateMutation.mutate({ id, data })
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const products = data?.products ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Bidhaa na Huduma</h1>
          <p className="text-sm text-gray-400 mt-1">
            Bidhaa na huduma zimeanishwa na mfumo wa AI, hivyo inajua bei na idadi ya vitu vilivyopo kwa wakati halisi.
          </p>
        </div>
        <button
          onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-[#20bd59] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Ongeza bidhaa au huduma
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading products…
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          Imeshindwa kupakia bidhaa/huduma..jaribu kurefresh
        </div>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400">Bado hakuna bidhaa/huduma zilizowekwa</p>
          <p className="text-xs text-gray-600 mt-1">Ongeza bidhaa au huduma yako ya kwanza ili kuanza kusimamia orodha ya bidhaa zako.</p>
          <button
            onClick={() => setEditTarget({})}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 px-4 py-2 text-sm font-medium text-[#6366f1] hover:bg-[#6366f1]/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Ongeza bidhaa/huduma
          </button>
        </div>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bidhaa/Huduma
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bei
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kiwango/idadi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-950">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-900/50 transition-colors group">
                  {/* Product name + image */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                          />
                        ) : null}
                        <div
                          className="w-full h-full items-center justify-center"
                          style={{ display: p.image_url ? 'none' : 'flex' }}
                        >
                          <ImageOff className="w-4 h-4 text-gray-600" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{p.name}</p>
                          {p.category === 'service' && (
                            <span className="text-[10px] uppercase font-semibold tracking-wider bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400">
                              Service
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-gray-300 font-mono">{fmt(p.price)}</td>

                  {/* Stock with conditional display */}
                  <td className="px-4 py-3">
                    {p.category === 'service' ? (
                      <span className="text-xs text-gray-500 italic select-none">
                        Haihitajiki
                      </span>
                    ) : (
                      <StockCell
                        product={p}
                        onAdjust={handleStockAdjust}
                        isUpdating={updateMutation.isPending}
                      />
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.is_active
                          ? 'bg-[#6366f1]/15 text-[#6366f1]'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5 transition-opacity opacity-100">
                      <button
                        onClick={() => setEditTarget(p)}
                        className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>


          <div className="px-4 py-2 border-t border-gray-800 bg-gray-900 text-xs text-gray-600 text-right">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </div>
        </div>
      )}

      {/* Modals */}
      {editTarget !== null && (
        <ProductModal
          product={editTarget?.id ? editTarget : null}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          isSaving={isSaving}
          errorMessage={saveErrorMessage}
        />
      )}

      {deleteTarget !== null && (
        <DeleteModal
          name={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
