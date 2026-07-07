'use client'

import { useState } from 'react'
import type { Transaction } from '../types'

export default function ConfirmTransactionModal({
  transaction, onClose, onConfirm,
}: {
  transaction: Transaction
  onClose: () => void
  onConfirm: (transactionId: string, confirmationCode: string) => Promise<any>
}) {
  const [confirmationCode, setConfirmationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleConfirm = async () => {
    if (!confirmationCode.trim()) {
      setMessage('Please enter a confirmation code')
      return
    }
    setLoading(true)
    try {
      const result = await onConfirm(transaction.id, confirmationCode.trim())
      if (result.error) {
        setMessage('Error: ' + result.error)
        return
      }
      setMessage('Transaction confirmed successfully!')
      setTimeout(onClose, 1500)
    } catch (err) {
      setMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to confirm'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl max-w-md w-full border border-white/10 p-4 sm:p-5 md:p-6">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Confirm Transaction</h2>
        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Confirmation Code</label>
            <input
              type="text"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              placeholder="e.g. UFSJB94EZQ"
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0a0a0a] border border-white/10 rounded-lg outline-none text-white text-sm"
            />
          </div>
          {message && (
            <div className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
              message.includes('success') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>{message}</div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
            <button onClick={onClose} className="flex-1 border border-white/20 py-1.5 sm:py-2 rounded-lg font-semibold transition text-sm hover:bg-white/5 order-2 sm:order-1">Cancel</button>
            <button onClick={handleConfirm} disabled={loading} className="flex-1 bg-[#f5c518] text-black py-1.5 sm:py-2 rounded-lg font-semibold transition disabled:opacity-50 text-sm order-1 sm:order-2">
              {loading ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
