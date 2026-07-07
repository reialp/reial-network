import type { MonthlyReport } from '../types'

export default function MonthlyReportTable({ monthlyReport }: { monthlyReport: MonthlyReport[] }) {
  if (monthlyReport.length === 0) return null

  return (
    <div className="mb-8 sm:mb-12">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">Monthly Performance Report</h2>
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#0a0a0a] border-b border-white/5">
              <tr>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Month</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Transactions</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Revenue (KES)</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Fees (KES)</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Earnings (KES)</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Unique Buyers</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden md:table-cell">Unique Films</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {monthlyReport.map((month) => (
                <tr key={`${month.year}-${month.month}`} className="hover:bg-white/5 transition">
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 font-medium">{month.month} {month.year}</td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right">{month.total_transactions}</td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-green-400">KES {month.total_revenue.toFixed(2)}</td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-yellow-400">KES {month.total_fees.toFixed(2)}</td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-purple-400">KES {month.total_earnings.toFixed(2)}</td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right hidden sm:table-cell">{month.unique_buyers}</td>
                  <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right hidden md:table-cell">{month.unique_films}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
