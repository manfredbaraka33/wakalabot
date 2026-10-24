import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, Search, Sparkles, X } from 'lucide-react'
import * as api from '../../api/superadmin'

const USD_TZS = 2600 // rough rate, only used for the cost estimate on the Overview tab
const tzs = (n) => Number(n || 0).toLocaleString()
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const cellInput = 'w-20 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3.5 shrink-0">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const Stat = ({ label, value, sub, onClick, hot }) => (
  <div onClick={onClick} className={`bg-gray-900 border rounded-xl p-4 ${hot ? 'border-amber-500/50' : 'border-gray-800'} ${onClick ? 'cursor-pointer hover:border-gray-700' : ''}`}>
    <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold text-white mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
)

function Overview({ goTo }) {
  const { data: o } = useQuery({ queryKey: ['sa-studio-overview'], queryFn: () => api.studioOverview().then((r) => r.data), refetchInterval: 30000 })
  if (!o) return <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
  const apiTzs = Math.round(o.api_cost_usd_30d * USD_TZS)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Creators" value={o.creators_total} sub={`+${o.creators_new_7d} wiki hii`} />
        <Stat label="Active 7d" value={o.active_7d} sub="walioatengeneza kitu" />
        <Stat label="Mapato 30d" value={`TZS ${tzs(o.revenue_tzs_30d)}`} sub={`Jumla: TZS ${tzs(o.revenue_tzs_all)}`} />
        <Stat label="Gharama ya API 30d" value={`$${o.api_cost_usd_30d.toFixed(2)}`} sub={`≈ TZS ${tzs(apiTzs)} (makadirio)`} />
        <Stat label="Credits zilizotumika 30d" value={tzs(o.credits_spent_30d)} />
        <Stat label="Credits zilizorudishwa 30d" value={tzs(o.credits_refunded_30d)} sub="kazi zilizoshindwa" />
        <Stat label="Malipo yanayosubiri" value={o.pending_payments} hot={o.pending_payments > 0} onClick={() => goTo('payments')} />
        <Stat label="Zilizotiliwa shaka 30d" value={o.flagged_30d} hot={o.flagged_30d > 0} onClick={() => goTo('jobs')} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[['Kazi 30d kwa hali', o.jobs_30d_by_status], ['Kazi 30d kwa njia', o.jobs_30d_by_mode]].map(([t, obj]) => (
          <div key={t} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t}</p>
            {Object.keys(obj).length === 0 ? <p className="text-sm text-gray-600">Hakuna bado</p> :
              Object.entries(obj).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-0.5"><span className="text-gray-400">{k}</span><span className="text-white font-medium">{v}</span></div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Payments() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('pending')
  const [target, setTarget] = useState(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState('')
  const { data = [], isLoading } = useQuery({
    queryKey: ['sa-studio-payments', status],
    queryFn: () => api.studioPayments(status).then((r) => r.data),
    refetchInterval: 20000,
  })
  const act = useMutation({
    mutationFn: ({ id, action, note }) => (action === 'approve' ? api.studioApprove(id, note) : api.studioReject(id, note)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa-studio-payments'] })
      qc.invalidateQueries({ queryKey: ['sa-studio-overview'] })
      setTarget(null)
      setNote('')
    },
  })
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${status === s ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-gray-700 text-gray-400'}`}>{s}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
            {['Tarehe', 'Mtumiaji', 'Pack', 'TZS', 'Reference', 'Hali', ''].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Inapakia…</td></tr> :
              data.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Hakuna.</td></tr> :
                data.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{when(p.created_at)}</td>
                    <td className="px-4 py-3"><p className="text-white">@{p.username}</p><p className="text-xs text-gray-500">{p.phone}</p></td>
                    <td className="px-4 py-3 text-gray-300">{p.pack_id} <span className="text-gray-600">({p.credits}{p.bonus_credits ? `+${p.bonus_credits}` : ''})</span></td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{tzs(p.amount_tzs)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { navigator.clipboard.writeText(p.reference); setCopied(p.id); setTimeout(() => setCopied(''), 1500) }}
                        className="flex items-center gap-1.5 font-mono text-xs text-gray-300 hover:text-white">
                        {p.reference} {copied === p.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-50" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{p.status}{p.admin_note ? ` · ${p.admin_note}` : ''}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {p.status === 'pending' && (<>
                        <button onClick={() => setTarget({ p, action: 'approve' })} className="text-xs rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 mr-2">Kubali</button>
                        <button onClick={() => setTarget({ p, action: 'reject' })} className="text-xs rounded-md border border-red-500/40 text-red-400 px-2.5 py-1">Kataa</button>
                      </>)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {target && (
        <Modal title={target.action === 'approve' ? 'Kubali malipo' : 'Kataa malipo'} onClose={() => setTarget(null)}>
          <p className="text-sm text-gray-300">@{target.p.username} · TZS {tzs(target.p.amount_tzs)} · pack {target.p.pack_id}</p>
          <p className="text-xs text-amber-300 mt-2">Linganisha reference <span className="font-mono">{target.p.reference}</span> na SMS ya muamala kwenye simu yako kabla ya kukubali.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={200} placeholder="Maelezo (si lazima)"
            className="w-full mt-3 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
          {act.isError && <p className="text-sm text-red-400 mt-2">{act.error?.response?.data?.detail || 'Imeshindwa.'}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setTarget(null)} className="px-4 py-2 text-sm text-gray-400">Ghairi</button>
            <button onClick={() => act.mutate({ id: target.p.id, action: target.action, note })} disabled={act.isPending}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${target.action === 'approve' ? 'bg-emerald-600' : 'bg-red-600'} disabled:opacity-50`}>
              {act.isPending ? '…' : 'Thibitisha'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CreatorModal({ id, onClose }) {
  const qc = useQueryClient()
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const { data: c } = useQuery({ queryKey: ['sa-studio-creator', id], queryFn: () => api.studioCreator(id).then((r) => r.data) })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sa-studio-creator', id] })
    qc.invalidateQueries({ queryKey: ['sa-studio-creators'] })
  }
  const grant = useMutation({ mutationFn: () => api.studioAdjust(id, parseInt(delta, 10), note), onSuccess: () => { setDelta(''); setNote(''); refresh() } })
  const toggle = useMutation({ mutationFn: (s) => api.studioSetStatus(id, s), onSuccess: refresh })
  return (
    <Modal title={c ? `@${c.username}` : 'Inapakia…'} onClose={onClose}>
      {!c ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">Simu</p><p className="text-white">{c.phone}</p></div>
            <div><p className="text-xs text-gray-500">Biashara</p><p className="text-white">{c.brand_name || '—'}</p></div>
            <div><p className="text-xs text-gray-500">Credits</p><p className="text-amber-300 font-bold text-lg">{c.credits}</p></div>
                        <div><p className="text-xs text-gray-500">Alialikwa na</p><p className="text-white">{c.referred_by ? `@${c.referred_by}` : '—'}</p></div>
            <div><p className="text-xs text-gray-500">Hali</p>
              <button onClick={() => toggle.mutate(c.status === 'active' ? 'suspended' : 'active')}
                className={`text-xs rounded-md px-2.5 py-1 border ${c.status === 'active' ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`}>
                {c.status} (bonyeza kubadilisha)
              </button></div>
          </div>
          <div className="border border-gray-800 rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-400">Ongeza au punguza credits (tumia minus kupunguza)</p>
            <div className="flex gap-2">
              <input value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+50" className="w-24 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sababu" maxLength={150} className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white" />
              <button onClick={() => grant.mutate()} disabled={!/^-?\d+$/.test(delta) || grant.isPending} className="rounded-lg bg-indigo-600 disabled:opacity-50 px-3 text-sm font-semibold">Weka</button>
            </div>
            {grant.isError && <p className="text-xs text-red-400">{grant.error?.response?.data?.detail || 'Imeshindwa.'}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1.5">Kazi za hivi karibuni</p>
            {c.jobs.length === 0 ? <p className="text-sm text-gray-600">Hakuna</p> : c.jobs.map((j) => (
              <div key={j.id} className="flex justify-between text-xs py-1 border-b border-gray-800/60">
                <span className="text-gray-300">{j.mode} · {j.status}{j.flagged ? ' ⚠️' : ''}</span>
                <span className="text-gray-500">{j.cost}cr · {when(j.created_at)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1.5">Ledger</p>
            {c.ledger.map((l, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-800/60">
                <span className="text-gray-300">{l.kind}{l.note ? ` · ${l.note}` : ''}</span>
                <span className={l.delta > 0 ? 'text-emerald-400' : 'text-gray-400'}>{l.delta > 0 ? '+' : ''}{l.delta} → {l.balance_after}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Creators() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const { data } = useQuery({ queryKey: ['sa-studio-creators', search], queryFn: () => api.studioCreators({ search: search || undefined }).then((r) => r.data) })
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tafuta username au namba…"
          className="w-full rounded-lg bg-gray-800 border border-gray-700 pl-9 pr-3 py-2 text-sm text-white" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
            {['Mtumiaji', 'Simu', 'Credits', 'Hali', 'Alijisajili', 'Aliingia mwisho'].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {(data?.items || []).map((c) => (
              <tr key={c.id} onClick={() => setOpen(c.id)} className="cursor-pointer hover:bg-gray-800/50">
                <td className="px-4 py-3 text-white">@{c.username}{c.brand_name ? <span className="text-gray-500"> · {c.brand_name}</span> : null}</td>
                <td className="px-4 py-3 text-gray-400">{c.phone}</td>
                <td className="px-4 py-3 text-amber-300 font-medium">{c.credits}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{c.status}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{when(c.created_at)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{when(c.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <CreatorModal id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

const marginCls = (m) => (m == null ? 'text-gray-600' : m < 40 ? 'text-red-400' : m < 60 ? 'text-amber-300' : 'text-emerald-400')
const Margin = ({ m }) => <span className={marginCls(m)}>{m == null ? '—' : `${m}%`}</span>

function ServiceRow({ s, onSaved }) {
  const [cost, setCost] = useState(String(s.cost))
  const [wm, setWm] = useState(s.watermark_cost == null ? '' : String(s.watermark_cost))
  const [est, setEst] = useState(String(s.est_cost_tzs))
  const [active, setActive] = useState(s.active)
  const dirty = cost !== String(s.cost) || wm !== (s.watermark_cost == null ? '' : String(s.watermark_cost)) || est !== String(s.est_cost_tzs) || active !== s.active
  const save = useMutation({
    mutationFn: () => api.studioUpdateService(s.key, {
      cost: Number(cost), watermark_cost: wm === '' ? null : Number(wm), est_cost_tzs: Number(est), active,
    }),
    onSuccess: onSaved,
  })
  return (
    <tr>
      <td className="px-4 py-3"><p className="text-white text-sm">{s.label}</p><p className="text-[11px] text-gray-600 font-mono">{s.key}</p></td>
      <td className="px-3 py-3"><input value={cost} onChange={(e) => setCost(e.target.value)} className={cellInput} /></td>
      <td className="px-3 py-3"><input value={wm} onChange={(e) => setWm(e.target.value)} placeholder="—" className={cellInput} /></td>
      <td className="px-3 py-3"><input value={est} onChange={(e) => setEst(e.target.value)} className={cellInput} /></td>
      <td className="px-3 py-3 text-xs whitespace-nowrap"><Margin m={s.margin_pct} /> · <Margin m={s.margin_pct_floor} /> · <Margin m={s.margin_pct_worst} /></td>
      <td className="px-3 py-3"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-indigo-500" /></td>
      <td className="px-3 py-3 text-right">
        <button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="text-xs rounded-md bg-indigo-600 disabled:opacity-30 px-3 py-1.5 font-semibold">
          {save.isPending ? '…' : 'Hifadhi'}
        </button>
      </td>
    </tr>
  )
}

function PackRow({ p, onSaved }) {
  const [price, setPrice] = useState(String(p.price_tzs))
  const [credits, setCredits] = useState(String(p.credits))
  const [active, setActive] = useState(p.active)
  const dirty = price !== String(p.price_tzs) || credits !== String(p.credits) || active !== p.active
  const save = useMutation({
    mutationFn: () => api.studioUpdatePack(p.id, { price_tzs: Number(price), credits: Number(credits), active }),
    onSuccess: onSaved,
  })
  const per = Number(credits) > 0 ? Math.round(Number(price) / Number(credits)) : 0
  return (
    <tr>
      <td className="px-4 py-3 text-white text-sm">{p.label} <span className="text-[11px] text-gray-600 font-mono">{p.id}</span></td>
      <td className="px-3 py-3"><input value={price} onChange={(e) => setPrice(e.target.value)} className={cellInput} /></td>
      <td className="px-3 py-3"><input value={credits} onChange={(e) => setCredits(e.target.value)} className={cellInput} /></td>
      <td className="px-3 py-3 text-xs text-gray-400">{per}/credit</td>
      <td className="px-3 py-3"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-indigo-500" /></td>
      <td className="px-3 py-3 text-right">
        <button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="text-xs rounded-md bg-indigo-600 disabled:opacity-30 px-3 py-1.5 font-semibold">
          {save.isPending ? '…' : 'Hifadhi'}
        </button>
      </td>
    </tr>
  )
}

function Pricing() {
  const qc = useQueryClient()
  const { data: services = [] } = useQuery({ queryKey: ['sa-studio-services'], queryFn: () => api.studioServices().then((r) => r.data) })
  const { data: packs = [] } = useQuery({ queryKey: ['sa-studio-packs'], queryFn: () => api.studioPacks().then((r) => r.data) })
  // Changing a pack changes every margin, so refresh both tables after any save.
  const saved = () => { qc.invalidateQueries({ queryKey: ['sa-studio-services'] }); qc.invalidateQueries({ queryKey: ['sa-studio-packs'] }) }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Huduma na bei (credits)</h3>
        <p className="text-xs text-gray-500 mb-2">Margin: kwa TZS 100/credit · kwa pack ya bei nafuu zaidi · pack nafuu + bonus ya ununuzi wa kwanza. Nyekundu chini ya 40%, njano chini ya 60%.</p>
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
              {['Huduma', 'Bei (cr)', 'Bei bure (cr)', 'Gharama (TZS)', 'Margin', 'Hai', ''].map((h) => <th key={h} className="px-3 py-3 text-left">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-800">{services.map((s) => <ServiceRow key={s.key} s={s} onSaved={saved} />)}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Packs za credits</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
              {['Pack', 'Bei (TZS)', 'Credits', 'Kwa credit', 'Hai', ''].map((h) => <th key={h} className="px-3 py-3 text-left">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-800">{packs.map((p) => <PackRow key={p.id} p={p} onSaved={saved} />)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Jobs() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [flagged, setFlagged] = useState(false)
  const { data = [] } = useQuery({
    queryKey: ['sa-studio-jobs', status, flagged],
    queryFn: () => api.studioJobs({ status: status || undefined, flagged: flagged || undefined }).then((r) => r.data),
    refetchInterval: 15000,
  })
  const refund = useMutation({ mutationFn: (id) => api.studioRefund(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-studio-jobs'] }) })
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {['', 'queued', 'running', 'done', 'failed'].map((s) => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${status === s ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-gray-700 text-gray-400'}`}>{s || 'zote'}</button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-gray-400 ml-2">
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} className="accent-amber-500" /> Zilizotiliwa shaka tu
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900">
        <table className="w-full text-sm min-w-[680px]">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
            {['Tarehe', 'Mtumiaji', 'Njia', 'Hali', 'Cr', 'Maelezo / Kosa', ''].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-800">
            {data.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{when(j.created_at)}</td>
                <td className="px-4 py-2.5 text-white">@{j.username}</td>
                <td className="px-4 py-2.5 text-gray-300">{j.mode}</td>
                <td className="px-4 py-2.5 text-xs">{j.status}{j.flagged ? ' ⚠️' : ''}</td>
                <td className="px-4 py-2.5 text-gray-300">{j.cost}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate" title={j.error || j.prompt}>{j.error || j.prompt || '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {j.cost > 0 && <button onClick={() => { if (window.confirm('Rudisha credits za kazi hii?')) refund.mutate(j.id) }} className="text-xs text-amber-300 hover:underline">Rudisha</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function AiModels() {
  const qc = useQueryClient()
  const { data: status } = useQuery({ queryKey: ['sa-studio-ai-status'], queryFn: () => api.studioAiStatus().then((r) => r.data) })
  const { data: models, isLoading, error } = useQuery({
    queryKey: ['sa-studio-ai-models'], queryFn: () => api.studioAiModels().then((r) => r.data.models), staleTime: 300000, retry: false,
  })
  const [results, setResults] = useState({})
  const [costs, setCosts] = useState({})

  async function runTest(id) {
    setResults((r) => ({ ...r, [id]: { loading: true } }))
    try {
      const { data } = await api.studioAiTest(id)
      setResults((r) => ({ ...r, [id]: data }))
    } catch (e) {
      setResults((r) => ({ ...r, [id]: { ok: false, error: e?.response?.data?.detail || 'Imeshindwa kuwasiliana na seva.' } }))
    }
  }
  const select = useMutation({
    mutationFn: ({ id, cost }) => api.studioAiSelect(id, cost),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sa-studio-ai-status'] }),
  })

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Model ya picha inayotumika sasa</p>
        {status?.model ? (
          <p className="text-lg text-emerald-300 font-mono mt-1">{status.model}
            <span className="text-xs text-gray-500 font-sans ml-2">gharama ${status.cost_usd}/picha · chanzo: {status.source}</span></p>
        ) : (
          <p className="text-amber-300 mt-1">Hakuna model iliyochaguliwa — AI posters (Andika/Sema) hazitafanya kazi mpaka uchague moja hapa chini.</p>
        )}
        <p className="text-xs text-gray-600 mt-2">Maandishi (headline, bei, simu) tunaandika wenyewe, kwa hiyo model ya bei nafuu zaidi ndiyo bora. Kila “Jaribu” linatengeneza picha 1 halisi (≈ $0.03).</p>
      </div>

      {isLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-500" />}
      {error && <p className="text-sm text-red-400">{error?.response?.data?.detail || 'Imeshindwa kupata orodha ya models.'}</p>}
      {models && models.length === 0 && <p className="text-sm text-gray-500">Google haikurudisha model yoyote ya picha kwa key hii. Hakikisha billing imewashwa kwenye project ya GEMINI_API_KEY.</p>}

      <div className="space-y-3">
        {(models || []).map((m) => {
          const r = results[m.id]
          const current = status?.model === m.id
          return (
            <div key={m.id} className={`bg-gray-900 border rounded-xl p-4 ${current ? 'border-emerald-500/40' : 'border-gray-800'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm text-white">{m.id}</p>
                {m.recommended && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 rounded-full px-2 py-0.5">inapendekezwa (nafuu)</span>}
                {current && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 rounded-full px-2 py-0.5">inatumika</span>}
              </div>
              <p className="text-xs text-gray-500 mt-1">{m.display_name}{m.description ? ` — ${m.description}` : ''}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button onClick={() => runTest(m.id)} disabled={r?.loading}
                  className="text-xs text-white rounded-md border border-gray-700 hover:border-indigo-500 px-3 py-1.5 disabled:opacity-50">
                  {r?.loading ? 'Inajaribu…' : 'Jaribu'}
                </button>
                <label className="text-xs text-gray-500 flex items-center gap-1.5">
                  gharama $
                  <input value={costs[m.id] ?? '0.034'} onChange={(e) => setCosts((c) => ({ ...c, [m.id]: e.target.value }))}
                    className="w-16 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white" />
                </label>
                <button onClick={() => select.mutate({ id: m.id, cost: Number(costs[m.id] ?? 0.034) })} disabled={select.isPending}
                  className="text-xs rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 font-semibold disabled:opacity-50">
                  Tumia hii
                </button>
              </div>
              {r?.loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mt-3" />}
              {r && !r.loading && r.ok && (
                <div className="mt-3 flex items-start gap-3">
                  <img src={r.preview} alt="test" className="w-40 rounded-lg border border-gray-800" />
                  <p className="text-xs text-emerald-400">Imefanya kazi: sekunde {r.seconds}, {r.width}×{r.height}.</p>
                </div>
              )}
              {r && !r.loading && !r.ok && (
                <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p>{r.error}</p>
                  {r.detail && <p className="text-red-400/70 mt-1 break-words">{r.detail}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


const TABS = [['overview', 'Overview'], ['payments', 'Malipo'], ['creators', 'Creators'], ['pricing', 'Bei'], ['jobs', 'Kazi'], ['ai', 'AI']]

export default function SuperAdminStudio() {
  const [tab, setTab] = useState('overview')
  const { data: o } = useQuery({ queryKey: ['sa-studio-overview'], queryFn: () => api.studioOverview().then((r) => r.data), refetchInterval: 30000 })
  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Sparkles className="w-6 h-6 text-fuchsia-400" /> Studio</h1>
      <div className="flex gap-1 border-b border-gray-800 overflow-x-auto">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === id ? 'border-indigo-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
            {id === 'payments' && o?.pending_payments > 0 && <span className="ml-1.5 text-[10px] bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-bold">{o.pending_payments}</span>}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview goTo={setTab} />}
      {tab === 'payments' && <Payments />}
      {tab === 'creators' && <Creators />}
      {tab === 'pricing' && <Pricing />}
      {tab === 'jobs' && <Jobs />}
      {tab === 'ai' && <AiModels />}
    </div>
  )
}