import type { CreatorStats } from '../types'

export default function CreatorDetailModal({
  creator, onClose,
}: {
  creator: CreatorStats
  onClose: () => void
}) {
  const revenue = Number(creator.total_revenue) || 0
  const fees = revenue * 0.15
  const earnings = revenue * 0.85

  const statRows: { label: string; value: string | number; color?: string }[] = [
    { label: 'Total Films', value: creator.total_films },
    { label: 'Approved Films', value: creator.approved_films, color: 'text-green-400' },
    { label: 'Pending Films', value: creator.pending_films, color: 'text-yellow-400' },
    { label: 'Rejected Films', value: creator.rejected_films, color: 'text-red-400' },
    { label: 'Total Views', value: creator.total_views, color: 'text-cyan-400' },
    { label: 'Total Purchases', value: creator.total_purchases, color: 'text-blue-400' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-white/10">
        {/* Header */}
        <div className="sticky top-0 bg-[#1a1a1a] px-4 sm:px-6 py-4 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f5c518]/20 flex items-center justify-center text-[#f5c518] text-lg font-bold flex-shrink-0">
              {creator.creator_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold truncate max-w-[180px] sm:max-w-[280px]">{creator.creator_name}</h2>
              <p className="text-gray-400 text-xs truncate max-w-[180px] sm:max-w-[280px]">{creator.email || 'No email on file'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition p-1 flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Revenue summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-[#0a0a0a] rounded-lg p-3 border border-white/5">
              <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Revenue</p>
              <p className="text-green-400 font-bold text-sm sm:text-base mt-1 truncate" title={`KES ${revenue.toFixed(2)}`}>
                KES {revenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-3 border border-white/5">
              <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Platform Fee (15%)</p>
              <p className="text-yellow-400 font-bold text-sm sm:text-base mt-1 truncate" title={`KES ${fees.toFixed(2)}`}>
                KES {fees.toFixed(2)}
              </p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-3 border border-white/5">
              <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Earnings (85%)</p>
              <p className="text-[#f5c518] font-bold text-sm sm:text-base mt-1 truncate" title={`KES ${earnings.toFixed(2)}`}>
                KES {earnings.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Content stats */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Content & Activity</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {statRows.map((row) => (
                <div key={row.label} className="bg-[#0a0a0a] rounded-lg p-3 border border-white/5">
                  <p className="text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-wider truncate">{row.label}</p>
                  <p className={`font-bold text-base sm:text-lg mt-1 ${row.color || 'text-white'}`}>{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Account details */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Account</h3>
            <div className="bg-[#0a0a0a] rounded-lg border border-white/5 divide-y divide-white/5">
              <div className="flex justify-between items-center px-3 py-2.5 text-xs sm:text-sm">
                <span className="text-gray-400">Phone</span>
                <span>{creator.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2.5 text-xs sm:text-sm">
                <span className="text-gray-400">Signup Date</span>
                <span>{creator.signup_date ? new Date(creator.signup_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2.5 text-xs sm:text-sm">
                <span className="text-gray-400">Last Active</span>
                <span>{creator.last_active ? new Date(creator.last_active).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center px-3 py-2.5 text-xs sm:text-sm">
                <span className="text-gray-400">Onboarding</span>
                <span className={creator.is_onboarded ? 'text-green-400' : 'text-yellow-400'}>
                  {creator.is_onboarded ? 'Complete' : 'Incomplete'}
                </span>
              </div>
              <div className="flex justify-between items-center px-3 py-2.5 text-xs sm:text-sm">
                <span className="text-gray-400">Payout Method</span>
                <span className={creator.has_payout_method ? 'text-green-400' : 'text-red-400'}>
                  {creator.has_payout_method ? 'Set up' : 'Not set up'}
                </span>
              </div>
            </div>
          </div>

          <button onClick={onClose} className="w-full border border-white/20 py-2 rounded-lg text-sm font-semibold hover:bg-white/5 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
