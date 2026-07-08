import type { Stats } from '../types'

export default function StatsGrid({ stats }: { stats: Stats }) {
  const items = [
    { label: 'Films', value: stats.totalFilms, color: '' },
    { label: 'Creators', value: stats.totalCreators, color: 'text-purple-400' },
    { label: 'Views', value: stats.totalViews, color: 'text-cyan-400' },
    { label: 'Sales', value: stats.totalSales, color: 'text-blue-400' },
    { label: 'Revenue', value: `KES ${Number(stats.totalRevenue).toFixed(2)}`, color: 'text-green-400' },
    // UPDATED: Changed from 15% to 30% platform fee
    { label: 'Fees (30%)', value: `KES ${Number(stats.totalPlatformFees).toFixed(2)}`, color: 'text-yellow-400' },
    { label: 'Payouts', value: `KES ${Number(stats.pendingPayouts).toFixed(2)}`, color: 'text-orange-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
      {items.map((item) => (
        <div key={item.label} className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5 min-w-0">
          <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium truncate">{item.label}</p>
          <p className={`text-sm sm:text-base md:text-lg font-bold mt-0.5 truncate ${item.color}`} title={String(item.value)}>
            {item.value}
          </p>
        </div>
      ))}
      <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-yellow-500/20 bg-yellow-500/5 min-w-0">
        <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium truncate">Pending</p>
        <p className="text-sm sm:text-base md:text-lg font-bold mt-0.5 text-yellow-400 truncate">{stats.pendingSubmissions}</p>
      </div>
    </div>
  )
}
