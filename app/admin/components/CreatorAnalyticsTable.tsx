import type { CreatorStats } from '../types'

export default function CreatorAnalyticsTable({
  filteredCreators, creatorSearchTerm, setCreatorSearchTerm,
  creatorSortBy, setCreatorSortBy,
}: {
  filteredCreators: CreatorStats[]
  creatorSearchTerm: string
  setCreatorSearchTerm: (v: string) => void
  creatorSortBy: 'name' | 'revenue' | 'films' | 'views'
  setCreatorSortBy: (v: 'name' | 'revenue' | 'films' | 'views') => void
}) {
  const viewCreatorDetails = (creator: CreatorStats) => {
    const revenue = Number(creator.total_revenue) || 0
    const fees = revenue * 0.15
    const earnings = revenue * 0.85
    alert(
      `Creator: ${creator.creator_name}\n` +
      `Email: ${creator.email || 'N/A'}\n` +
      `Total Films: ${creator.total_films}\n` +
      `Total Revenue: KES ${revenue.toFixed(2)}\n` +
      `Platform Fees (15%): KES ${fees.toFixed(2)}\n` +
      `Creator Earnings (85%): KES ${earnings.toFixed(2)}\n` +
      `Approved Films: ${creator.approved_films}\n` +
      `Pending Films: ${creator.pending_films}\n` +
      `Rejected Films: ${creator.rejected_films}\n` +
      `Phone: ${creator.phone || 'N/A'}`
    )
  }

  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Creator Analytics</h2>
          <p className="text-gray-400 text-xs sm:text-sm">Click on any creator to view full details and stats</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search creators..."
            value={creatorSearchTerm}
            onChange={(e) => setCreatorSearchTerm(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-xs sm:text-sm min-w-[120px]"
          />
          <select
            value={creatorSortBy}
            onChange={(e) => setCreatorSortBy(e.target.value as any)}
            className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm outline-none"
          >
            <option value="revenue">Sort by Revenue</option>
            <option value="views">Sort by Views</option>
            <option value="films">Sort by Films</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#0a0a0a] border-b border-white/5">
              <tr>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Creator</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Email</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Status</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Films</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden md:table-cell">Views</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Revenue</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden lg:table-cell">Earnings</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCreators.length === 0 ? (
                <tr><td colSpan={8} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No creators found.</td></tr>
              ) : (
                filteredCreators.map((creator) => (
                  <tr key={creator.creator_id} className="hover:bg-white/5 transition">
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#f5c518]/20 flex items-center justify-center text-[#f5c518] text-xs sm:text-sm font-bold">
                          {creator.creator_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-[120px]">{creator.creator_name}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[100px]">{creator.email || 'N/A'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {creator.has_phone && <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Has phone" />}
                        {creator.has_payout_method && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Has payout method" />}
                        {!creator.has_phone && !creator.has_payout_method && <span className="text-gray-500 text-[8px]">Incomplete</span>}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-xs sm:text-sm">
                      <span className="font-semibold">{creator.total_films}</span>
                      <span className="text-gray-500 text-[8px] sm:text-xs ml-1">
                        ({creator.pending_films > 0 && `${creator.pending_films} pending`}
                        {creator.pending_films > 0 && creator.approved_films > 0 && ', '}
                        {creator.approved_films > 0 && `${creator.approved_films} approved`})
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-400 text-xs hidden md:table-cell">{creator.total_views}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right font-semibold text-green-400 text-xs sm:text-sm">KES {Number(creator.total_revenue).toFixed(2)}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right font-semibold text-yellow-400 text-xs sm:text-sm hidden lg:table-cell">KES {Number(creator.total_earnings).toFixed(2)}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center">
                      <button onClick={() => viewCreatorDetails(creator)} className="bg-[#f5c518] text-black px-2 sm:px-3 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-semibold hover:bg-[#e0b010] transition whitespace-nowrap">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
