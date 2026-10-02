import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, Check, Loader2, BookOpen } from 'lucide-react'
import { knowledgeApi } from '../../api/knowledge'

// ── Edit / Create modal ───────────────────────────────────────────────────────
function KBModal({ entry, onClose, onSave, isSaving }) {
  const [text, setText] = useState(entry?.content ?? '')
  const isNew = !entry

  function handleSubmit(e) {
    e.preventDefault()
    if (text.trim()) onSave(text.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <h3 className="text-base font-semibold text-white">
            {isNew ? 'Add Knowledge Entry' : 'Edit Knowledge Entry'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Maudhui/taarifa
            </label>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              
              placeholder={`E.g Tunafanya delivery ndani ya Mwanza kwa 3,000 TZS.\nHatubadilishi bidhaa baada ya kununuliwa.\nKwa maswali ya haraka piga simu: 0712 345 678.\nTunakubali malipo ya M-Pesa na CRDB.`}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] resize-none transition-colors"
            />
            <p className="mt-1 text-xs text-gray-500 text-right">{text.length} / 10,000</p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !text.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-[#20bd59] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isNew ? 'Saving…' : 'Updating…'}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isNew ? 'Save' : 'Update'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────
function DeleteModal({ onClose, onConfirm, isDeleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Futa taarifa?</p>
            <p className="text-xs text-gray-400 mt-0.5">
             Hii itaondoa taarifa hii kwenye ufahamu wa AI.
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
export default function KnowledgeBaseManager() {
  const queryClient = useQueryClient()
  const [editTarget, setEditTarget] = useState(null) // null = closed, {} = new, {id,content} = edit
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: ['knowledge'],
    queryFn: knowledgeApi.list,
  })

  const createMutation = useMutation({
    mutationFn: ({ content }) => knowledgeApi.create(content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setEditTarget(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, content }) => knowledgeApi.update(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setEditTarget(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => knowledgeApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] })
      setDeleteTarget(null)
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleSave(content) {
    if (editTarget?.id) {
      updateMutation.mutate({ id: editTarget.id, content })
    } else {
      createMutation.mutate({ content })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Render ─────────────────────────────────────────────────────────────────
  const entries = data?.entries ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Maudhui ya Biashara</h1>
          <p className="text-sm text-gray-400 mt-1">
            Kila kitu unachoweka hapa kinatumiwa na bot yako ya AI kujibu maswali ya wateja.
          </p>
        </div>
        <button
          onClick={() => setEditTarget({})}
          className="inline-flex items-center gap-2 rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-[#20bd59] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Weka taarifa
        </button>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Inapakia maudhui…
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          Imeshindwa kupakia maudhui. Tafadhari refresh.
        </div>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-400">Bado hakuna taarifa iliyowekwa</p>
          <p className="text-xs text-gray-600 mt-1">
            Weka taarifa yako ya kwanza ili kuanza kuifundisha bot yako ya AI.
          </p>
          <button
            onClick={() => setEditTarget({})}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#6366f1]/15 border border-[#6366f1]/30 px-4 py-2 text-sm font-medium text-[#6366f1] hover:bg-[#6366f1]/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Weka taarifa yako ya kwanza
          </button>
        </div>
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="group flex items-start gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              {/* Index badge */}
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-md bg-gray-800 flex items-center justify-center text-xs font-mono text-gray-500">
                {index + 1}
              </span>

              {/* Content */}
              <p className="flex-1 text-sm text-gray-300 whitespace-pre-wrap wrap-break-word overflow-auto">
                {entry.content}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0 ">
                <button
                  onClick={() => setEditTarget(entry)}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-blue-500/15 hover:text-blue-400 flex items-center justify-center text-gray-400 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(entry.id)}
                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-red-500/15 hover:text-red-400 flex items-center justify-center text-gray-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-600 text-right pt-1">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      )}

      {/* Modals */}
      {editTarget !== null && (
        <KBModal
          entry={editTarget?.id ? editTarget : null}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}

      {deleteTarget !== null && (
        <DeleteModal
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
