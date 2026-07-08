'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useAdminData } from './hooks/useAdminData'
import { exportReport } from './lib/exportReport'
import StatsGrid from './components/StatsGrid'
import ActivityLogPanel from './components/ActivityLogPanel'

const ContentModerationTable = dynamic(() => import('./components/ContentModerationTable'), {
  loading: () => <TabSkeleton />,
})
const CreatorAnalyticsTable = dynamic(() => import('./components/CreatorAnalyticsTable'), {
  loading: () => <TabSkeleton />,
})
const PayoutsTable = dynamic(() => import('./components/PayoutsTable'), {
  loading: () => <TabSkeleton />,
})
const TransactionsTable = dynamic(() => import('./components/TransactionsTable'), {
  loading: () => <TabSkeleton />,
})
const MonthlyReportTable = dynamic(() => import('./components/MonthlyReportTable'), {
  loading: () => <TabSkeleton />,
})

function TabSkeleton() {
  return (
    <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 p-8 text-center text-gray-500 text-sm">
      Loading…
    </div>
  )
}

type Tab = 'content' | 'creators' | 'payouts' | 'transactions' | 'reports'

const TABS: { id: Tab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'creators', label: 'Creators' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports' },
]

export default function AdminPage() {
  const data = useAdminData()
  const [activeTab, setActiveTab] = useState<Tab>('content')
  const [showActivityLogs, setShowActivityLogs] = useState(false)

  const handleShowLogs = async () => {
    if (!showActivityLogs) await data.loadActivityLogs()
    setShowActivityLogs(!showActivityLogs)
  }

  if (data.loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Manage content, approvals, and payouts. (15% Platform Fee)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={data.refreshData}
              disabled={data.refreshing}
              className="px-3 py-1.5 bg-[#f5c518] text-black rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 flex items-center gap-1"
            >
              {data.refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button onClick={handleShowLogs} className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs sm:text-sm hover:bg-[#2a2a2a] transition">
              {showActivityLogs ? 'Hide Logs' : 'Activity Logs'}
            </button>
            <button
              onClick={() => exportReport(data.stats, data.monthlyReport, data.filteredContent, data.creatorStats, data.dateRange)}
              className="px-3 py-1.5 bg-[#f5c518] text-black rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#e0b010] transition"
            >
              Export Report
            </button>
          </div>
        </div>

        {showActivityLogs && (
          <ActivityLogPanel
            activityLogs={data.activityLogs}
            loadingLogs={data.loadingLogs}
            onClose={() => setShowActivityLogs(false)}
          />
        )}

        <StatsGrid stats={data.stats} />

        {data.stats.pendingSubmissions > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-yellow-400 text-xs sm:text-sm">
              <span className="font-bold">{data.stats.pendingSubmissions}</span> project{data.stats.pendingSubmissions > 1 ? 's' : ''} awaiting approval.
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-4 sm:mb-6 border-b border-white/5 pb-3 sm:pb-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${
                activeTab === tab.id ? 'bg-[#f5c518] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'content' && (
          <ContentModerationTable
            filteredContent={data.filteredContent}
            statusFilter={data.statusFilter}
            setStatusFilter={data.setStatusFilter}
            searchTerm={data.searchTerm}
            setSearchTerm={data.setSearchTerm}
            dateRange={data.dateRange}
            setDateRange={data.setDateRange}
            pendingSubmissions={data.stats.pendingSubmissions}
            onApprove={data.handleApprove}
            onReject={data.handleReject}
            onRevoke={data.handleRevokeApproval}
            onDelete={data.handleDeleteContent}
          />
        )}

        {activeTab === 'creators' && (
          <CreatorAnalyticsTable
            filteredCreators={data.filteredCreators}
            creatorSearchTerm={data.creatorSearchTerm}
            setCreatorSearchTerm={data.setCreatorSearchTerm}
            creatorSortBy={data.creatorSortBy}
            setCreatorSortBy={data.setCreatorSortBy}
          />
        )}

        {activeTab === 'payouts' && (
          <PayoutsTable
            filteredPayouts={data.filteredPayouts}
            payoutFilter={data.payoutFilter}
            setPayoutFilter={data.setPayoutFilter}
            onMarkPaid={data.handleMarkPayoutPaid}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTable
            transactions={data.transactions}
            onConfirm={data.handleConfirmTransaction}
          />
        )}

        {activeTab === 'reports' && (
          <MonthlyReportTable monthlyReport={data.monthlyReport} />
        )}
      </div>
    </div>
  )
}
