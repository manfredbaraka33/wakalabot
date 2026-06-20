import { Link } from 'react-router-dom'
import {
  MessageSquare,
  Users,
  Zap,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import useTenantStore from '../../store/useTenantStore'
import useLiveAnalytics from '../../hooks/useLiveAnalytics'

const numberFormatter = new Intl.NumberFormat()

function formatNumber(value) {
  return numberFormatter.format(value ?? 0)
}

function StatCard({ label, value, hint, icon: Icon, color, bg }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function LoadingStatCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-gray-800" />
        <div className="w-9 h-9 rounded-lg bg-gray-800" />
      </div>
      <div className="h-8 w-20 rounded bg-gray-800" />
      <div className="mt-2 h-3 w-32 rounded bg-gray-800" />
    </div>
  )
}

function ActiveDashboard({ user, tenantId }) {
  const { stats, loading, refreshing, error, reload } = useLiveAnalytics()

  const statCards = [
    {
      label: 'Messages Today',
      value: formatNumber(stats?.active_today ?? 0),
      hint: 'Messages received in the last 24 hours.',
      icon: MessageSquare,
      color: 'text-indigo-400',
      bg: 'bg-indigo-400/15',
    },
    {
      label: 'Active Customers',
      value: formatNumber(stats?.active_customers_today ?? 0),
      hint: 'Unique conversations active in the last 24 hours.',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-400/15',
    },
    {
      label: 'AI Responses',
      value: formatNumber(stats?.ai_vs_human_ratio?.assistant_messages ?? 0),
      hint: `${stats?.ai_vs_human_ratio?.assistant_percentage ?? 0}% of all messages so far.`,
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/15',
    },
    {
      label: 'Total Chats',
      value: formatNumber(stats?.total_chats ?? 0),
      hint: `${formatNumber(stats?.total_messages ?? 0)} messages exchanged across all conversations.`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-400/15',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back{user?.business_name ? `, ${user.business_name}` : ''}!
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Your summary cards update automatically from live conversation analytics.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-full border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-400">
          <span className="inline-flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${refreshing ? 'bg-amber-300' : 'bg-indigo-400 animate-pulse'}`} />
            {refreshing ? 'Refreshing live stats...' : 'System is active'}
          </span>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1 rounded-full border border-gray-800 px-2.5 py-1 text-gray-300 transition-colors hover:border-gray-700 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && !stats ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading && !stats
          ? Array.from({ length: 4 }, (_, index) => <LoadingStatCard key={index} />)
          : statCards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      {!loading && (stats?.total_messages ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/70 px-5 py-4 text-sm text-gray-400">
          Waiting for your first customers... live metrics will appear here as soon as messages start coming in.
        </div>
      ) : null}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard/knowledge"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-4 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-500/25 transition-colors"
          >
            Train your AI bot
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/dashboard/conversations"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            View Conversations
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/dashboard/analytics"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Open Analytics
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {tenantId && null}

      {error && stats ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}
    </div>
  )
}

const QUICK_ACTIONS = [
  { icon: MessageSquare, title: 'Conversations', description: 'View all customer conversations' },
  { icon: TrendingUp, title: 'Analytics', description: 'See usage and performance insights' },
  { icon: Zap, title: 'Knowledge Base', description: 'Train your AI with business content' },
  { icon: Users, title: 'Products', description: 'Manage your product catalogue' },
]

export default function Overview() {
  const { user, tenantId } = useTenantStore()
  return <ActiveDashboard user={user} tenantId={tenantId} />
}
