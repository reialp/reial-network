'use client'

import { useState } from 'react'
import type { Content, ContentStatus, Stats } from '../types'
import PreviewModal from './PreviewModal'

export default function ContentModerationTable({
  filteredContent, statusFilter, setStatusFilter, searchTerm, setSearchTerm,
  dateRange, setDateRange, pendingSubmissions,
  onApprove, onReject, onRevoke, onDelete,
}: {
  filteredContent: Content[]
  statusFilter: ContentStatus
  setStatusFilter: (v: ContentStatus) => void
  searchTerm: string
  setSearchTerm: (v: string) => void
  dateRange: { start: string; end: string }
  setDateRange: (v: { start: string; end: string }) => void
  pendingSubmissions: number
  onApprove: (id: string) => Promise<any>
  onReject: (id: string) => Promise<any>
  onRevoke: (id: string) => Promise<any>
  onDelete: (id: string) => Promise<any>
}) {
  const [previewFilm, setPreviewFilm] = useState<Content | null>(null)

  const handleApprove = async (id: string) => {
    const result = await onApprove(id)
    if (!result.success) alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
  }
  const handleReject = async (id: string) => {
    const result = await onReject(id)
    if (!result.success) alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
  }
  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke approval for this film?')) return
    const result = await onRevoke(id)
    if (!result.success) alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this film permanently?')) return
    const result = await onDelete(id)
    if (!result.success) alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center mb-4 sm:mb-6">
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as ContentStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition ${
                statusFilter === status ? 'bg-[#f5c518] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status === 'pending' && pendingSubmissions > 0 && (
                <span className="ml-1 sm:ml-2 bg-yellow-500/20 text-yellow-400 px-1 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs">{pendingSubmissions}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-xs sm:text-sm outline-none" />
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-xs sm:text-sm outline-none" />
          <button onClick={() => setDateRange({ start: '', end: '' })} className="px-2 py-1 text-gray-400 hover:text-white text-xs sm:text-sm">Clear</button>
          <input
            type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-xs sm:text-sm min-w-[120px]"
          />
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden mb-8 sm:mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-[#0a0a0a] border-b border-white/5">
              <tr>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Title</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Creator</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden md:table-cell">Price</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden lg:table-cell">Sales</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Status</th>
                <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredContent.length === 0 ? (
                <tr><td colSpan={6} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No content found.</td></tr>
              ) : (
                filteredContent.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition">
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <div className="flex items-center gap-1.5 sm:gap-3">
                        <div className="w-6 h-8 sm:w-8 sm:h-10 md:w-10 md:h-14 bg-[#0a0a0a] rounded overflow-hidden flex-shrink-0">
                          {item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                        </div>
                        <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-[120px] md:max-w-[150px]">{item.title}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[100px]">{item.creator_name || 'Unknown'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 font-semibold text-xs hidden md:table-cell">KES {item.price}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden lg:table-cell">{item.purchase_count}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${
                        item.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        item.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>{item.status}</span>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <div className="flex gap-1 sm:gap-2 flex-wrap">
                        <button onClick={() => setPreviewFilm(item)} className="text-[#f5c518] hover:underline text-[8px] sm:text-xs font-semibold">Preview</button>
                        {item.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(item.id)} className="text-green-400 hover:underline text-[8px] sm:text-xs font-semibold">Approve</button>
                            <button onClick={() => handleReject(item.id)} className="text-red-400 hover:underline text-[8px] sm:text-xs font-semibold">Reject</button>
                          </>
                        )}
                        {item.status === 'approved' && (
                          <button onClick={() => handleRevoke(item.id)} className="text-yellow-400 hover:underline text-[8px] sm:text-xs font-semibold">Revoke</button>
                        )}
                        <button onClick={() => handleDelete(item.id)} className="text-gray-500 hover:text-red-500 transition">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewFilm && (
        <PreviewModal
          film={previewFilm}
          onClose={() => setPreviewFilm(null)}
          onApprove={async () => { await handleApprove(previewFilm.id); setPreviewFilm(null) }}
          onReject={async () => { await handleReject(previewFilm.id); setPreviewFilm(null) }}
        />
      )}
    </>
  )
}
