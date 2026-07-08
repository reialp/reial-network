'use client'

import { useState } from 'react'
import type { Transaction } from '../types'
import ConfirmTransactionModal from './ConfirmTransactionModal'

export default function TransactionsTable({
  transactions, onConfirm,
}: {
  transactions: Transaction[]
  onConfirm: (transactionId: string, confirmationCode: string) => Promise<any>
}) {
  const [selected, setSelected] = useState<Transaction | null>(null)

  return (
    <>
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">Transaction History</h2>
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#0a0a0a] border-b border-white/5">
              <tr>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Film</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Buyer</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden md:table-cell">Amount</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Status</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden lg:table-cell">Confirmation</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No transactions found.</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition">
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-xs truncate max-w-[80px] sm:max-w-[120px]">{tx.content?.title || 'N/A'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[100px]">{tx.buyer?.email || 'Unknown'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-[#f5c518] font-semibold text-xs hidden md:table-cell">KES {tx.amount_paid}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>{tx.status}</span>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-[8px] sm:text-xs font-mono hidden lg:table-cell truncate max-w-[80px]">{tx.pesapal_transaction_id || '—'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      {tx.status !== 'completed' && (
                        <button onClick={() => setSelected(tx)} className="bg-[#f5c518] text-black px-1.5 sm:px-3 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-semibold hover:bg-[#e0b010] transition">Confirm</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ConfirmTransactionModal
          transaction={selected}
          onClose={() => setSelected(null)}
          onConfirm={onConfirm}
        />
      )}
    </>
  )
}
