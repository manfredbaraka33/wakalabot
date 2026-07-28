import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Users, TrendingUp, Coins, Ticket, BarChart3, Zap, MessageSquare, Bot,
} from 'lucide-react'
import {
  getStats, getRevenueTrend, getUserGrowth, getAiActivity,
} from '../../api/superadmin'

const RANGE_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function RangeSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            value === opt.value
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const customTooltipStyle = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#f9fafb',
  fontSize: '12px',
}

function formatTZS(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return String(v)
}

function shortDate(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function SuperAdminDashboard() {
  const [range, setRange] = useState(30)

  const { data: stats } = useQuery({
    queryKey: ['sa-stats'],
    queryFn: () => getStats().then((r) => r.data),
  })

  const { data: revenue = [] } = useQuery({
    queryKey: ['sa-revenue', range],
    queryFn: () => getRevenueTrend(range).then((r) => r.data),
  })

  const { data: growth = [] } = useQuery({
    queryKey: ['sa-growth', range],
    queryFn: () => getUserGrowth(range).then((r) => r.data),
  })

  const { data: activity = {} } = useQuery({
    queryKey: ['sa-activity', range],
    queryFn: () => getAiActivity(range).then((r) => r.data),
  })

  const revenueChart = revenue.map((d) => ({ ...d, date: shortDate(d.date) }))
  const growthChart = growth.map((d) => ({ ...d, date: shortDate(d.date) }))
  const activityChart = (activity?.coins_chart ?? []).map((d) => ({ ...d, date: shortDate(d.date) }))
  const messagesTrend = (activity?.daily_trend ?? []).map((d) => ({
    date: shortDate(d.date),
    messages: d.count,
    coins: 0, // will be merged with activityChart below
  }))

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#6366f1]" />
            Platform Overview
          </h1>
          <p className="text-gray-400 text-sm mt-1">Real-time KPIs across the Wakalabot ecosystem.</p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Tenants"
          value={stats?.total_tenants ?? '—'}
          sub="Registered businesses"
          icon={Users}
          color="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          label="Total Revenue"
          value={stats ? `TZS ${formatTZS(stats.total_revenue_tzs)}` : '—'}
          sub="All-time platform payments"
          icon={TrendingUp}
          color="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
        label="AI Messages (30d)"
        value={activity?.total_messages?.toLocaleString() ?? '—'}
        sub={`Leo: ${activity?.today_messages?.toLocaleString() ?? '—'} · Tenants ${activity?.active_tenants ?? '—'} hai`}
        icon={Bot}
        color="bg-amber-500/15 text-amber-400"
/>
        <StatCard
          label="Open Tickets"
          value={stats?.open_tickets ?? '—'}
          sub="Pending + In Progress"
          icon={Ticket}
          color="bg-rose-500/15 text-rose-400"
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Revenue Trend */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Revenue Trend (TZS)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatTZS} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={customTooltipStyle}
                formatter={(v) => [`TZS ${v.toLocaleString()}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* User Growth */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">User Growth (New Tenants)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={growthChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={customTooltipStyle} formatter={(v) => [v, 'New Tenants']} />
              <Bar dataKey="new_tenants" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 xl:col-span-2 space-y-5">

          {/* Header with split stats */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">AI Activity</h2>
              <p className="text-xs text-gray-500 mt-0.5">Messages na coins zote za platform</p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                <span className="text-gray-400">Eco:</span>
                <span className="text-white font-medium">{activity?.eco_messages?.toLocaleString() ?? '—'}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                <span className="text-gray-400">Smart:</span>
                <span className="text-white font-medium">{activity?.smart_messages?.toLocaleString() ?? '—'}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span className="text-gray-400">Sub:</span>
                <span className="text-white font-medium">{activity?.subscription_messages?.toLocaleString() ?? '—'}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                <span className="text-gray-400">Coins:</span>
                <span className="text-white font-medium">{activity?.coin_messages?.toLocaleString() ?? '—'}</span>
              </span>
            </div>
          </div>

          {/* Mini KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-950 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500">API Cost ({activity?.period_days ?? 30}d)</p>
              <p className="text-sm font-bold text-orange-400 mt-0.5">
                ${activity?.total_cost_usd?.toFixed(3) ?? '—'}
              </p>
            </div>
            <div className="bg-gray-950 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500">Prompt Tokens</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {activity?.total_prompt_tokens?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div className="bg-gray-950 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500">Completion Tokens</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {activity?.total_completion_tokens?.toLocaleString() ?? '—'}
              </p>
            </div>
          </div>

          {/* Dual chart — messages + coins */}
          <div>
            <p className="text-xs text-gray-500 mb-3">Messages kwa siku (mstari wa bluu) · Coins (mstari wa njano)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={messagesTrend.map((d, i) => ({
                  ...d,
                  coins: activityChart[i]?.coins ?? 0,
                }))}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={customTooltipStyle}
                  formatter={(v, name) => [
                    v.toLocaleString(),
                    name === 'messages' ? 'Messages' : 'Coins',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1' }}
                />
                <Line
                  type="monotone"
                  dataKey="coins"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top tenants by usage */}
          {activity?.top_tenants?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Top Tenants — AI Usage
              </p>
              <div className="space-y-2.5">
                {activity.top_tenants.map((t, i) => {
                  const maxCount = activity.top_tenants[0].message_count
                  const pct = Math.max((t.message_count / maxCount) * 100, 5)
                  return (
                    <div key={t.tenant_id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-gray-600 w-4 shrink-0 font-mono">{i + 1}</span>
                          <span className="text-gray-200 truncate font-medium">{t.biz_name}</span>
                          <span className="text-gray-600 font-mono hidden sm:inline text-[10px]">
                            @{t.username}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-amber-400 font-semibold">
                            {t.message_count.toLocaleString()} msgs
                          </span>
                          <span className="text-gray-600 text-[10px]">
                            ${t.cost_usd.toFixed(3)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-amber-300/40 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
