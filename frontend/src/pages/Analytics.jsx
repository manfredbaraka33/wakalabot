import { RefreshCw, MessageSquareMore, Activity, Bot, Clock3, TrendingUp } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import useLiveAnalytics from '../hooks/useLiveAnalytics'

const numberFormatter = new Intl.NumberFormat()

function formatNumber(value) {
  return numberFormatter.format(value ?? 0)
}

function formatDayLabel(value) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function getPeakHourStyle(count, maxCount) {
  if (!maxCount || count === 0) {
    return {
      className: 'border-gray-800 text-gray-600',
      style: { backgroundColor: 'rgba(31,31,31,0.6)' },
    }
  }
  const intensity = count / maxCount
  const alpha = 0.12 + intensity * 0.88
  const textClass = intensity >= 0.5 ? 'text-gray-950' : intensity >= 0.2 ? 'text-emerald-200' : 'text-gray-400'
  return {
    className: `border-[#6366f1]/30 ${textClass}`,
    style: { backgroundColor: `rgba(37,211,102,${alpha.toFixed(2)})` },
  }
}

function StatCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 animate-pulse">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-gray-800" />
        <div className="h-10 w-10 rounded-xl bg-gray-800" />
      </div>
      <div className="h-8 w-20 rounded bg-gray-800" />
      <div className="mt-3 h-3 w-32 rounded bg-gray-800" />
    </div>
  )
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{formatDayLabel(label)}</p>
      <p className="mt-1 text-sm font-medium text-white">
        Ujumbe {formatNumber(payload[0].value)}
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/70 px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6366f1]/12">
        <TrendingUp className="h-7 w-7 text-[#6366f1]" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-white">Tunasubiri wateja wako wa kwanza...</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
        Mara tu ujumbe utakapoanza kuingia, dashibodi hii itaonyesha idadi ya kila siku,
        bidhaa zinazovutia, na masaa yako yenye shughuli nyingi.
      </p>
    </div>
  )
}

export default function Analytics() {
  const { stats, loading, refreshing, error, reload } = useLiveAnalytics()

  const trendData = Object.entries(stats?.customer_inquiries_trend ?? {}).map(([date, count]) => ({
    date,
    label: formatDayLabel(date),
    count,
  }))
  const topProducts = stats?.top_products ?? []
  const peakHours = stats?.peak_hours ?? []
  const maxPeakCount = Math.max(...peakHours.map((entry) => entry.count), 0)
  const totalMessages = stats?.total_messages ?? 0
  const hasMessages = totalMessages > 0
  const peakHour = stats?.peak_hour

  const statCards = [
    {
      label: 'Mazungumzo Yote',
      value: formatNumber(stats?.total_chats ?? 0),
      hint: 'Mazungumzo tofauti ya wateja yaliyofuatiliwa hadi sasa.',
      icon: MessageSquareMore,
      tone: 'bg-[#6366f1]/15 text-[#6366f1]',
    },
    {
      label: 'Ujumbe wa Leo',
      value: formatNumber(stats?.active_today ?? 0),
      hint: 'Ujumbe uliopokelewa katika masaa 24 yaliyopita.',
      icon: Activity,
      tone: 'bg-sky-500/15 text-sky-300',
    },
    {
      label: 'Wastani wa Ujumbe / Mazungumzo',
      value: formatNumber(stats?.avg_messages_per_chat ?? 0),
      hint: 'Wastani wa ujumbe unaobadilishana kwa kila mazungumzo.',
      icon: Bot,
      tone: 'bg-amber-500/15 text-amber-300',
    },
    {
      label: 'Saa Yenye Shughuli Zaidi',
      value: peakHour?.count ? formatHourLabel(peakHour.hour) : '—',
      hint: peakHour?.count ? `Ujumbe ${formatNumber(peakHour.count)} katika saa yenye shughuli zaidi.` : 'Bado hakuna takwimu za kutosha.',
      icon: Clock3,
      tone: 'bg-fuchsia-500/15 text-fuchsia-300',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics za Moja kwa Moja</h1>
          <p className="mt-1 text-sm text-gray-400">
            Fuatilia idadi ya mazungumzo, bidhaa zinazovutia, na shughuli za wateja kadri ujumbe unavyoingia.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-full border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${refreshing ? 'bg-amber-300' : 'bg-[#6366f1]'}`} />
            {refreshing ? 'Inasasisha...' : 'Inasasisha kila sekunde 15'}
          </span>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2.5 py-1 text-gray-300 transition-colors hover:border-gray-700 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Sasisha
          </button>
        </div>
      </div>

      {error && !stats ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-5 py-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !stats
          ? Array.from({ length: 4 }, (_, index) => <LoadingCard key={index} />)
          : statCards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      {!loading && !hasMessages ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
          <Panel
            title="Maswali ya Wateja — Siku 7"
            subtitle="Ujumbe wa wateja kwa siku (unaoingia tu) katika siku saba zilizopita."
            action={
              <span className="rounded-full bg-gray-950 px-3 py-1 text-xs text-gray-500">
                Ujumbe {formatNumber(totalMessages)} jumla
              </span>
            }
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDayLabel}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#6366f1', stroke: '#111827', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#111827', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel
              title="Bidhaa Zinazovutia Zaidi"
              subtitle="Bidhaa zinazotajwa mara nyingi zaidi na wateja kwenye chati."
            >
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Bado hakuna bidhaa zilizotajwa.</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((product, index) => {
                    const topCount = topProducts[0]?.count || 1
                    const width = Math.max((product.count / topCount) * 100, 14)
                    return (
                      <div key={product.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-xs font-medium text-[#6366f1]">
                              {index + 1}
                            </span>
                            <span className="truncate text-gray-300">{product.name}</span>
                          </div>
                          <span className="text-gray-500">{formatNumber(product.count)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-950">
                          <div className="h-full rounded-full bg-linear-to-r from-[#6366f1] via-emerald-300 to-lime-200" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            <Panel
              title="Masaa Yenye Shughuli Zaidi"
              subtitle="Kadri rangi inavyong'aa, ndivyo saa hiyo ina shughuli zaidi kwa bot yako."
            >
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {peakHours.map((entry) => {
                  const tone = getPeakHourStyle(entry.count, maxPeakCount)
                  return (
                  <div
                    key={entry.hour}
                    className={`rounded-xl border px-3 py-3 text-center ${tone.className}`}
                    style={tone.style}
                  >
                    <p className="text-xs font-medium">{formatHourLabel(entry.hour)}</p>
                    <p className="mt-1 text-sm font-semibold">{formatNumber(entry.count)}</p>
                  </div>
                  )
                })}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {error && stats ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-5 py-4 text-sm text-amber-100">
          {error}
        </div>
      ) : null}
    </div>
  )
}