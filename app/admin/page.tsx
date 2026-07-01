'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  getAllContent, 
  approveContent, 
  rejectContent, 
  revokeApproval,
  confirmTransaction,
  processPayout
} from '@/app/actions/admin'

function getEmbedUrl(url: string): string {
  if (!url) return ''
  if (url.includes('/embed/')) return url
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`
  return url
}

type ContentStatus = 'all' | 'pending' | 'approved' | 'rejected'

interface Content {
  id: string
  title: string
  description: string
  thumbnail_url: string
  video_url: string
  trailer_url: string
  category: string
  price: number
  release_year: number
  language: string
  subtitles: string
  status: string
  views: number
  purchase_count: number
  created_at: string
  slug: string | null
  creator_id: string
  creator_name: string
}

interface PayoutRequest {
  id: string
  creator_id: string
  amount: number
  phone: string
  status: string
  requested_at: string
  processed_at: string | null
  profiles: {
    full_name: string
  }
}

interface Transaction {
  id: string
  content_id: string
  buyer_id: string
  amount_paid: number
  platform_fee: number
  creator_earnings: number
  watch_token: string
  status: string
  pesapal_transaction_id: string | null
  created_at: string
  content: { title: string } | null
  buyer: { email: string } | null
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<Content[]>([])
  const [filteredContent, setFilteredContent] = useState<Content[]>([])
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState({
    totalFilms: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalPlatformFees: 0,
    totalPaidToCreators: 0,
    pendingPayouts: 0,
    pendingSubmissions: 0,
  })

  const [statusFilter, setStatusFilter] = useState<ContentStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewFilm, setPreviewFilm] = useState<Content | null>(null)
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'processed'>('all')

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')

  useEffect(() => {
    loadAdminData()
  }, [])

  useMemo(() => {
    let filtered = [...content]
    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((c) =>
        c.title.toLowerCase().includes(term) ||
        (c.creator_name?.toLowerCase() || '').includes(term)
      )
    }
    setFilteredContent(filtered)
  }, [content, statusFilter, searchTerm])

  const loadAdminData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (!profile?.is_admin) {
        router.push('/dashboard')
        return
      }

      const result = await getAllContent()
      if (result.error) {
        console.error('Error fetching content:', result.error)
      } else {
        setContent(result.content || [])
      }

      // Fetch Payouts
      const { data: payoutsData } = await supabase
        .from('payout_requests')
        .select('*, profiles(full_name)')
        .order('requested_at', { ascending: false })
      setPayouts(payoutsData || [])

      // Fetch Transactions
      const { data: transData } = await supabase
        .from('purchases')
        .select('*, content(title), buyer:profiles(email)')
        .order('created_at', { ascending: false })
      setTransactions(transData || [])

      // Calculate Stats
      const totalRevenue = transData?.reduce((sum, t) => sum + t.amount_paid, 0) || 0
      const totalPlatformFees = transData?.reduce((sum, t) => sum + t.platform_fee, 0) || 0
      
      setStats({
        totalFilms: result.content?.length || 0,
        totalSales: transData?.length || 0,
        totalRevenue,
        totalPlatformFees,
        totalPaidToCreators: totalRevenue - totalPlatformFees,
        pendingPayouts: payoutsData?.filter(p => p.status === 'pending').length || 0,
        pendingSubmissions: result.content?.filter((c: any) => c.status === 'pending').length || 0,
      })

    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('Are you sure you want to approve this content?')) return
    try {
      const result = await approveContent(id)
      if (result.success) {
        alert('✅ Content approved successfully!')
        loadAdminData()
      } else {
        alert('❌ Error: ' + result.error)
      }
    } catch (err) {
      alert('❌ Failed to approve content')
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter a reason for rejection:')
    if (reason === null) return
    try {
      const result = await rejectContent(id)
      if (result.success) {
        alert('✅ Content rejected.')
        loadAdminData()
      } else {
        alert('❌ Error: ' + result.error)
      }
    } catch (err) {
      alert('❌ Failed to reject content')
    }
  }

  const handleRevokeApproval = async (id: string) => {
    if (!confirm('Revoke approval? This will hide the content from users.')) return
    try {
      const result = await revokeApproval(id)
      if (result.success) {
        alert('✅ Approval revoked.')
        loadAdminData()
      }
    } catch (err) {
      alert('❌ Failed to revoke approval')
    }
  }

  const handleConfirmTransaction = async () => {
    if (!selectedTransaction || !confirmationCode) return
    setConfirmLoading(true)
    try {
      const result = await confirmTransaction(selectedTransaction.id, confirmationCode)
      if (result.success) {
        setConfirmMessage('✅ Transaction confirmed!')
        setTimeout(() => {
          setIsConfirmModalOpen(false)
          setConfirmationCode('')
          setSelectedTransaction(null)
          setConfirmMessage('')
          loadAdminData()
        }, 1500)
      } else {
        setConfirmMessage('❌ Error: ' + result.error)
      }
    } catch (err) {
      setConfirmMessage('❌ Failed to confirm')
    } finally {
      setConfirmLoading(false)
    }
  }

  const handleProcessPayout = async (id: string) => {
    if (!confirm('Mark this payout as processed?')) return
    try {
      const result = await processPayout(id)
      if (result.success) {
        alert('✅ Payout marked as processed.')
        loadAdminData()
      }
    } catch (err) {
      alert('❌ Failed to process payout')
    }
  }

  const openPreview = (film: Content) => {
    setPreviewFilm(film)
    setIsPreviewOpen(true)
  }

  const closePreview = () => {
    setIsPreviewOpen(false)
    setPreviewFilm(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f5c518]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400">Manage content, payouts, and platform performance</p>
          </div>
          <button 
            onClick={loadAdminData}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition text-sm"
          >
            Refresh Data
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
            <h3 className="text-2xl font-bold text-[#f5c518]">KES {stats.totalRevenue.toLocaleString()}</h3>
          </div>
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Platform Fees</p>
            <h3 className="text-2xl font-bold text-green-500">KES {stats.totalPlatformFees.toLocaleString()}</h3>
          </div>
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Pending Submissions</p>
            <h3 className="text-2xl font-bold text-blue-500">{stats.pendingSubmissions}</h3>
          </div>
          <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Pending Payouts</p>
            <h3 className="text-2xl font-bold text-red-500">{stats.pendingPayouts}</h3>
          </div>
        </div>

        {/* Content Management Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold">Content Management</h2>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search films or creators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] outline-none text-sm w-64"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ContentStatus)}
                className="px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] outline-none text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Film</th>
                    <th className="px-6 py-4 font-semibold">Creator</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredContent.length > 0 ? (
                    filteredContent.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02] transition group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                              {item.thumbnail_url && (
                                <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                            <span className="font-medium truncate max-w-[200px]">{item.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">{item.creator_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">{item.category}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                            item.status === 'pending' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button 
                              onClick={() => openPreview(item)}
                              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition"
                              title="Preview"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {item.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => handleApprove(item.id)}
                                  className="p-2 hover:bg-green-500/20 rounded-lg text-green-500 transition"
                                  title="Approve"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleReject(item.id)}
                                  className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition"
                                  title="Reject"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                        No content found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {isPreviewOpen && previewFilm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
              <div className="aspect-video bg-black relative">
                <iframe
                  src={getEmbedUrl(previewFilm.trailer_url)}
                  className="w-full h-full"
                  allowFullScreen
                ></iframe>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{previewFilm.title}</h2>
                    <p className="text-[#f5c518] font-medium">{previewFilm.category} • {previewFilm.release_year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Price</p>
                    <p className="text-xl font-bold">KES {previewFilm.price}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-gray-300 leading-relaxed">{previewFilm.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-white/5">
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Creator</p>
                    <p className="text-sm font-medium">{previewFilm.creator_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Language</p>
                    <p className="text-sm font-medium">{previewFilm.language}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Subtitles</p>
                    <p className="text-sm font-medium">{previewFilm.subtitles || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-1">Submitted</p>
                    <p className="text-sm font-medium">{new Date(previewFilm.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  {previewFilm.status === 'pending' ? (
                    <>
                      <button 
                        onClick={() => { handleApprove(previewFilm.id); closePreview(); }}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                      >
                        Approve Content
                      </button>
                      <button 
                        onClick={() => { handleReject(previewFilm.id); closePreview(); }}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition"
                      >
                        Reject Content
                      </button>
                    </>
                  ) : previewFilm.status === 'approved' && (
                    <button 
                      onClick={() => { handleRevokeApproval(previewFilm.id); closePreview(); }}
                      className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-semibold hover:bg-yellow-600 transition"
                    >
                      Revoke Approval
                    </button>
                  )}
                  <button 
                    onClick={closePreview}
                    className="flex-1 border border-white/20 py-2 rounded-lg font-semibold hover:bg-white/5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Code Modal */}
        {isConfirmModalOpen && selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-2xl max-w-md w-full border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4">Confirm Transaction</h2>
              <p className="text-gray-400 text-sm mb-4">
                Enter the confirmation code from PesaPal for this transaction.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Film</label>
                  <p className="text-white">{selectedTransaction.content?.title || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
                  <p className="text-[#f5c518] font-bold">KES {selectedTransaction.amount_paid}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Confirmation Code</label>
                  <input
                    type="text"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    placeholder="e.g. UFSJB94EZQ"
                    className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                  />
                </div>
                
                {confirmMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    confirmMessage.includes('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {confirmMessage}
                  </div>
                )}
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setIsConfirmModalOpen(false)
                      setConfirmationCode('')
                      setSelectedTransaction(null)
                      setConfirmMessage('')
                    }}
                    className="flex-1 border border-white/20 py-2 rounded-lg font-semibold hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmTransaction}
                    disabled={confirmLoading}
                    className="flex-1 bg-[#f5c518] text-black py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
                  >
                    {confirmLoading ? 'Confirming...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
