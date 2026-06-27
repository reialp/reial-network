'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  status: 'pending' | 'approved' | 'rejected' | 'draft'
  views: number
  purchase_count: number
  created_at: string
  profiles: {
    full_name: string
  }
}

interface PayoutRequest {
  id: string
  creator_id: string
  amount: number
  phone: string
  status: 'pending' | 'processed'
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
  })

  const [statusFilter, setStatusFilter] = useState<ContentStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewFilm, setPreviewFilm] = useState<Content | null>(null)
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'processed'>('all')

  useEffect(() => {
    loadAdminData()
  }, [])

  useMemo(() => {
    let filtered = [...content]
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(term) ||
        c.profiles?.full_name?.toLowerCase().includes(term)
      )
    }
    setFilteredContent(filtered)
  }, [content, statusFilter, searchTerm])

  const loadAdminData = async () => {
    setLoading(true)

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

    // ✅ Fetch ALL content from ALL creators (no filter)
    const { data: contentData } = await supabase
      .from('content')
      .select(`
        *,
        profiles ( full_name )
      `)
      .order('created_at', { ascending: false })

    const allContent = contentData || []
    const totalFilms = allContent.length
    const totalSales = allContent.reduce((sum, c) => sum + (c.purchase_count || 0), 0)
    const totalRevenue = allContent.reduce((sum, c) => sum + (c.price * (c.purchase_count || 0)), 0)

    const { data: purchases } = await supabase
      .from('purchases')
      .select('platform_fee, creator_earnings')

    const totalPlatformFees = purchases?.reduce((sum, p) => sum + (p.platform_fee || 0), 0) || 0
    const totalPaidToCreators = purchases?.reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0

    const { data: pendingPayoutsData } = await supabase
      .from('payout_requests')
      .select('amount')
      .eq('status', 'pending')

    const pendingPayouts = pendingPayoutsData?.reduce((sum, p) => sum + p.amount, 0) || 0

    setStats({
      totalFilms,
      totalSales,
      totalRevenue,
      totalPlatformFees,
      totalPaidToCreators,
      pendingPayouts,
    })

    setContent(allContent as Content[])
    setFilteredContent(allContent as Content[])

    const { data: payoutData } = await supabase
      .from('payout_requests')
      .select(`
        *,
        profiles ( full_name )
      `)
      .order('requested_at', { ascending: false })

    setPayouts(payoutData as PayoutRequest[])

    // ✅ NEW: Fetch ALL transactions with buyer info
    const { data: transactionsData } = await supabase
      .from('purchases')
      .select(`
        *,
        content:content_id ( title ),
        buyer:buyer_id ( email )
      `)
      .order('created_at', { ascending: false })

    setTransactions(transactionsData || [])

    setLoading(false)
  }

  const handleApprove = async (contentId: string) => {
    const { error } = await supabase.from('content').update({ status: 'approved' }).eq('id', contentId)
    if (error) alert('Error: ' + error.message)
    else loadAdminData()
  }

  const handleReject = async (contentId: string) => {
    const { error } = await supabase.from('content').update({ status: 'rejected' }).eq('id', contentId)
    if (error) alert('Error: ' + error.message)
    else loadAdminData()
  }

  const handleRevokeApproval = async (contentId: string) => {
    if (!confirm('Revoke approval for this film?')) return
    const { error } = await supabase.from('content').update({ status: 'pending' }).eq('id', contentId)
    if (error) alert('Error: ' + error.message)
    else loadAdminData()
  }

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Delete this film permanently?')) return
    const { error } = await supabase.from('content').delete().eq('id', contentId)
    if (error) alert('Error: ' + error.message)
    else loadAdminData()
  }

  const handleMarkPayoutPaid = async (payoutId: string) => {
    if (!confirm('Mark this payout as paid?')) return
    const { error } = await supabase
      .from('payout_requests')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', payoutId)
    if (error) alert('Error: ' + error.message)
    else loadAdminData()
  }

  const handlePreview = (film: Content) => {
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
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  const filteredPayouts = payouts.filter(p => {
    if (payoutFilter === 'all') return true
    return p.status === payoutFilter
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-400 mb-8">Manage content, approvals, and payouts.</p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Total Films</p>
            <p className="text-2xl font-bold mt-1">{stats.totalFilms}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Total Sales</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{stats.totalSales}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Revenue</p>
            <p className="text-2xl font-bold mt-1 text-green-400">KES {stats.totalRevenue}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Platform Fees</p>
            <p className="text-2xl font-bold mt-1 text-yellow-400">KES {stats.totalPlatformFees}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Paid to Creators</p>
            <p className="text-2xl font-bold mt-1 text-purple-400">KES {stats.totalPaidToCreators}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Pending Payouts</p>
            <p className="text-2xl font-bold mt-1 text-orange-400">KES {stats.pendingPayouts}</p>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex flex-wrap gap-4 items-center mb-6">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected'] as ContentStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  statusFilter === status
                    ? 'bg-[#f5c518] text-black'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by title or creator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500"
            />
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a0a] border-b border-white/5">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Title</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Creator</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Price</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Views</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Sales</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Revenue</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredContent.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-gray-500">No content found.</td>
                  </tr>
                ) : (
                  filteredContent.map((film) => {
                    const revenue = film.price * film.purchase_count
                    return (
                      <tr key={film.id} className="hover:bg-white/5 transition">
                        <td className="px-4 sm:px-6 py-3 font-medium">{film.title}</td>
                        <td className="px-4 sm:px-6 py-3 text-gray-400">{film.profiles?.full_name || 'Unknown'}</td>
                        <td className="px-4 sm:px-6 py-3 text-[#f5c518] font-semibold">KES {film.price}</td>
                        <td className="px-4 sm:px-6 py-3 text-gray-400">{film.views}</td>
                        <td className="px-4 sm:px-6 py-3 text-gray-400">{film.purchase_count}</td>
                        <td className="px-4 sm:px-6 py-3 text-green-400">KES {revenue}</td>
                        <td className="px-4 sm:px-6 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${film.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                              film.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              film.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-gray-500/20 text-gray-400'}`}>
                            {film.status}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handlePreview(film)} className="text-blue-400 hover:text-blue-300 text-xs transition">Preview</button>
                            {film.status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(film.id)} className="text-green-400 hover:text-green-300 text-xs transition">Approve</button>
                                <button onClick={() => handleReject(film.id)} className="text-red-400 hover:text-red-300 text-xs transition">Reject</button>
                              </>
                            )}
                            {film.status === 'approved' && (
                              <button onClick={() => handleRevokeApproval(film.id)} className="text-yellow-400 hover:text-yellow-300 text-xs transition">Revoke</button>
                            )}
                            <button onClick={() => handleDeleteContent(film.id)} className="text-red-400 hover:text-red-300 text-xs transition">Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payout Requests */}
        <h2 className="text-2xl font-bold mb-4">Payout Requests</h2>
        <div className="flex gap-3 mb-4">
          {(['all', 'pending', 'processed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setPayoutFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                payoutFilter === status
                  ? 'bg-[#f5c518] text-black'
                  : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a0a] border-b border-white/5">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Creator</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Amount</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Phone</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Requested</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">No payout requests.</td>
                  </tr>
                ) : (
                  filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-white/5 transition">
                      <td className="px-4 sm:px-6 py-3">{payout.profiles?.full_name || 'Unknown'}</td>
                      <td className="px-4 sm:px-6 py-3 text-[#f5c518] font-bold">KES {payout.amount}</td>
                      <td className="px-4 sm:px-6 py-3">{payout.phone}</td>
                      <td className="px-4 sm:px-6 py-3 text-gray-400">{new Date(payout.requested_at).toLocaleDateString()}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          payout.status === 'processed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {payout.status === 'processed' ? '✅ Paid' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        {payout.status === 'pending' && (
                          <button
                            onClick={() => handleMarkPayoutPaid(payout.id)}
                            className="bg-[#f5c518] text-black px-3 py-1 rounded text-xs font-semibold hover:bg-[#e0b010] transition"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ NEW: Transactions Section */}
        <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a0a] border-b border-white/5">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Film</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Buyer</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Amount</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">PesaPal Code</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">No transactions yet.</td>
                  </tr>
                ) : (
                  transactions.map((tx: Transaction) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition">
                      <td className="px-4 sm:px-6 py-3">{tx.content?.title || 'N/A'}</td>
                      <td className="px-4 sm:px-6 py-3 text-gray-400">{tx.buyer?.email || 'Unknown'}</td>
                      <td className="px-4 sm:px-6 py-3 text-[#f5c518] font-semibold">KES {tx.amount_paid}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className="font-mono text-xs bg-[#0a0a0a] px-2 py-1 rounded border border-white/10">
                          {tx.pesapal_transaction_id || '—'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {tx.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-gray-400 text-xs">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Modal */}
        {isPreviewOpen && previewFilm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
              <div className="sticky top-0 bg-[#1a1a1a] px-6 py-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold">{previewFilm.title}</h2>
                <button onClick={closePreview} className="text-gray-400 hover:text-white transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="aspect-video bg-[#0a0a0a] rounded-xl overflow-hidden">
                  <iframe
                    src={getEmbedUrl(previewFilm.video_url)}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm text-gray-400">Description</h3>
                    <p className="mt-1">{previewFilm.description || 'No description.'}</p>
                  </div>
                  <div className="space-y-2">
                    <div><span className="text-sm text-gray-400">Creator:</span> <span className="ml-2">{previewFilm.profiles?.full_name || 'Unknown'}</span></div>
                    <div><span className="text-sm text-gray-400">Price:</span> <span className="ml-2 text-[#f5c518] font-bold">KES {previewFilm.price}</span></div>
                    <div><span className="text-sm text-gray-400">Category:</span> <span className="ml-2">{previewFilm.category || 'N/A'}</span></div>
                    <div><span className="text-sm text-gray-400">Views:</span> <span className="ml-2">{previewFilm.views}</span></div>
                    <div><span className="text-sm text-gray-400">Sales:</span> <span className="ml-2">{previewFilm.purchase_count}</span></div>
                    <div><span className="text-sm text-gray-400">Revenue:</span> <span className="ml-2 text-green-400">KES {previewFilm.price * previewFilm.purchase_count}</span></div>
                    <div><span className="text-sm text-gray-400">Status:</span> <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium
                      ${previewFilm.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        previewFilm.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        previewFilm.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'}`}>
                      {previewFilm.status}
                    </span></div>
                  </div>
                </div>
                {previewFilm.trailer_url && (
                  <div>
                    <h3 className="text-sm text-gray-400 mb-2">Trailer</h3>
                    <div className="aspect-video bg-[#0a0a0a] rounded-xl overflow-hidden">
                      <iframe
                        src={getEmbedUrl(previewFilm.trailer_url)}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  {previewFilm.status === 'pending' && (
                    <>
                      <button onClick={() => { handleApprove(previewFilm.id); closePreview(); }} className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition">Approve</button>
                      <button onClick={() => { handleReject(previewFilm.id); closePreview(); }} className="flex-1 bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 transition">Reject</button>
                    </>
                  )}
                  {previewFilm.status === 'approved' && (
                    <button onClick={() => { handleRevokeApproval(previewFilm.id); closePreview(); }} className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-semibold hover:bg-yellow-600 transition">Revoke Approval</button>
                  )}
                  <button onClick={closePreview} className="flex-1 border border-white/20 py-2 rounded-lg font-semibold hover:bg-white/5 transition">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
