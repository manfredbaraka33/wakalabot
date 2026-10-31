import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { mediaUrl, studioApi, downloadMedia } from './studioApi'
import { aspectOf } from './sizes'

const BADGE = {
  queued: ['Inasubiri', 'bg-gray-500/15 text-gray-300'],
  running: ['Inatengenezwa', 'bg-indigo-500/15 text-indigo-300'],
  done: ['Tayari', 'bg-emerald-500/15 text-emerald-300'],
  failed: ['Imeshindwa', 'bg-red-500/15 text-red-300'],
}

export default function StudioLibrary() {
  const qc = useQueryClient()
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['studio-jobs'],
    queryFn: () => studioApi.listJobs().then((r) => r.data),
    refetchInterval: 6000,
  })
  const del = useMutation({
    mutationFn: (id) => studioApi.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['studio-jobs'] }),
  })

  if (isLoading) return <div className="flex justify-center py-16 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-gray-400">Bado hujatengeneza tangazo lolote.</p>
        <Link to="/studio/app" className="inline-block rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold">Tengeneza la kwanza</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Kazi Zangu</h1>
        <p className="text-sm text-gray-400 mt-1">Kazi zinafutwa kiotomatiki baada ya siku 30 — pakua unazotaka kuhifadhi.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {jobs.map((j) => {
          const [label, cls] = BADGE[j.status] || BADGE.queued
          return (
            <div key={j.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
              <div className="relative bg-gray-950 flex items-center justify-center" style={{ aspectRatio: j.media_type === 'video' ? '9 / 16' : aspectOf(j.fmt) }}>
                {j.media_type === 'video' && j.media_url && (
                  <video src={mediaUrl(j.media_url)} controls playsInline preload="metadata" className="absolute inset-0 z-10 w-full h-full object-cover bg-black" />
                )}
                {j.media_url ? (
                  <img src={mediaUrl(j.media_url)} alt={j.headline || 'Tangazo'} loading="lazy" className="w-full h-full object-cover" />
                ) : j.status === 'queued' || j.status === 'running' ? (
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                ) : (
                  <p className="text-xs text-gray-600 px-3 text-center">{j.status === 'done' ? 'Faili imefutwa (siku 30)' : 'Hakuna picha'}</p>
                )}
              </div>
              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
                  <span className="text-[10px] text-gray-600">{j.created_at ? new Date(j.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''}</span>
                </div>
                {j.headline && <p className="text-xs text-gray-300 line-clamp-2">{j.headline}</p>}
                {j.status === 'failed' && j.error && <p className="text-[11px] text-red-300 line-clamp-3">{j.error}</p>}
                <div className="flex gap-2 mt-auto pt-1">
                  {j.media_url && (
                    <button
                      onClick={() => downloadMedia(j.media_url, `wakalabot-${j.id.slice(0, 8)}.jpg`)
                        .catch(() => window.alert('Imeshindwa kupakua. Pakia upya ukurasa kisha ujaribu tena.'))}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-gray-800 hover:bg-gray-700 py-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> Pakua
                    </button>
                  )}
                  {(j.status === 'done' || j.status === 'failed') && (
                    <button onClick={() => { if (window.confirm('Futa kazi hii?')) del.mutate(j.id) }}
                      className="rounded-lg border border-gray-700 hover:border-red-500/50 text-red-400 px-2.5 py-1.5" title="Futa">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}