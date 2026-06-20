import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HelpCircle, CheckCircle, Clock } from 'lucide-react'
import apiClient from '../../api/axios'

const CATEGORY_LABELS = {
  product_info: '📦 Bidhaa',
  service_info: '🛠️ Huduma',
  pricing: '💰 Bei',
  policy: '📋 Sera',
  location: '📍 Mahali',
  other: '❓ Nyingine',
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('sw-TZ', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

export default function UnansweredQuestions() {
  const qc = useQueryClient()

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['unanswered-questions'],
    queryFn: () => apiClient.get('/api/v1/unanswered-questions').then(r => r.data),
    refetchInterval: 30000,
  })

  const resolveMut = useMutation({
    mutationFn: (id) => apiClient.patch(`/api/v1/unanswered-questions/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unanswered-questions'] }),
  })

  const pending = questions.filter(q => !q.is_resolved)
  const resolved = questions.filter(q => q.is_resolved)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-yellow-400" />
            Maswali Bila Majibu
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Maswali ambayo bot haikuweza kujibu. Ongeza taarifa hizo kwenye mfumo wako.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-center">
            <p className="text-yellow-400 text-xl font-bold">{pending.length}</p>
            <p className="text-gray-500 text-xs">Yanayosubiri</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-center">
            <p className="text-emerald-400 text-xl font-bold">{resolved.length}</p>
            <p className="text-gray-500 text-xs">Yaliyotatuliwa</p>
          </div>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-4 py-3">
          <p className="text-yellow-400 text-xs font-semibold">
            💡 Maswali haya yanaonyesha pengo katika maudhui yako. 
            Ongeza majibu kwenye Knowledge Base au Products ili bot iweze kujibu mara ijayo.
          </p>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Inapakia...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-white font-medium">Vizuri sana!</p>
            <p className="text-gray-500 text-sm">Bot imejibu maswali yote. Hakuna pengo la maudhui.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Swali</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Aina</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Tarehe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Hali</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Hatua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {questions.map(q => (
                <tr key={q.id} className={`hover:bg-gray-800/50 transition-colors ${q.is_resolved ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-200 text-sm leading-relaxed">{q.question}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2.5 py-1">
                      {CATEGORY_LABELS[q.category] || q.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {formatDate(q.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {q.is_resolved
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3 h-3" /> Imetatuliwa</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-yellow-400"><Clock className="w-3 h-3" /> Inasubiri</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!q.is_resolved && (
                      <button
                        onClick={() => resolveMut.mutate(q.id)}
                        disabled={resolveMut.isPending}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white font-medium transition-colors disabled:opacity-40"
                      >
                        Imeshughulikiwa
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}