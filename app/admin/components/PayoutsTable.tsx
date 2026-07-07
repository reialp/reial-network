import type { PayoutRequest } from '../types'

export default function PayoutsTable({
  filteredPayouts, payoutFilter, setPayoutFilter, onMarkPaid,
}: {
  filteredPayouts: PayoutRequest[]
  payoutFilter: 'all' | 'pending' | 'processed'
  setPayoutFilter: (v: 'all' | 'pending' | 'processed') => void
  onMarkPaid: (id: string) => Promise<any>
}) {
  const handleMarkPaid = async (id: string) => {
    if (!confirm('Mark this payout as paid?')) return
    const result = await onMarkPaid(id)
    if (!result.success) alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Payout Requests</h2>
        <select value={payoutFilter} onChange={(e) => setPayoutFilter(e.target.value as any)}
          className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm outline-none w-full sm:w-auto">
          <option value="all">All Payouts</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
        </select>
      </div>
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden mb-8 sm:mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#0a0a0a] border-b border-white/5">
              <tr>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Creator</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Amount</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Phone</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Status</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPayouts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No payout requests.</td></tr>
              ) : (
                filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-white/5 transition">
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-xs">{payout.profiles?.full_name || 'Unknown'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 font-semibold text-green-400 text-xs sm:text-sm">KES {payout.amount}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell">{payout.phone}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${
                        payout.status === 'processed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>{payout.status === 'processed' ? 'Paid' : 'Pending'}</span>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      {payout.status === 'pending' && (
                        <button onClick={() => handleMarkPaid(payout.id)} className="bg-[#f5c518] text-black px-1.5 sm:px-3 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-semibold hover:bg-[#e0b010] transition">Mark Paid</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
