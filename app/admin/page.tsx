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
  slug: string | null
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
    pendingSubmissions: 0,
  })

  const [statusFilter, setStatusFilter] = useState<ContentStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewFilm, setPreviewFilm] = useState<Content | null>(null)
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'processed'>('all')

  // ✅ Confirmation Code Modal
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

    // ✅ Fetch ALL content from ALL creators (no filter - everyone's submissions)
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
    const pendingSubmissions = allContent.filter(c => c.status === 'pending').length

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
      pendingSubmissions,
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

  // ✅ Handle confirmation code submission
  const handleConfirmTransaction = async () => {
    if (!selectedTransaction || !confirmationCode.trim()) {
      setConfirmMessage('Please enter a confirmation code')
      return
    }

    setConfirmLoading(true)
    setConfirmMessage('')

    const { error } = await supabase
      .from('purchases')
      .update({
        pesapal_transaction_id: confirmationCode.trim(),
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedTransaction.id)

    if (error) {
      setConfirmMessage('Error: ' + error.message)
    } else {
      setConfirmMessage('✅ Transaction confirmed successfully!')
      if (selectedTransaction.content_id) {
        await supabase.rpc('increment_sales', { content_id: selectedTransaction.content_id })
      }
      setTimeout(() => {
        setIsConfirmModalOpen(false)
        setConfirmationCode('')
        setSelectedTransaction(null)
        loadAdminData()
      }, 1500)
    }
    setConfirmLoading(false)
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

  // ✅ Open confirmation modal
  const openConfirmModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setConfirmationCode('')
    setConfirmMessage('')
    setIsConfirmModalOpen(true)
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

        {/* ✅ Stats - Now includes Pending Submissions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
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
          {/* ✅ NEW: Pending Submissions Card */}
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-yellow-500/20 bg-yellow-500/5">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Pending Submissions</p>
            <p className="text-2xl font-bold mt-1 text-yellow-400">{stats.pendingSubmissions}</p>
          </div>
        </div>

        {/* ✅ Notification for pending submissions */}
        {stats.pendingSubmissions > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm">
              📤 <span className="font-bold">{stats.pendingSubmissions}</span> project{stats.pendingSubmissions > 1 ? 's' : ''} awaiting approval.
              Click the <span className="font-bold">"Pending"</span> filter above to review them.
            </p>
          </div>
        )}

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
                {status === 'pending' && stats.pendingSubmissions > 0 && (
                  <span className="ml-2 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs">
                    {stats.pendingSubmissions}
                  </span>
                )}
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
                                <button onClick={() => handleApprove(f
