'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  getAllContent, 
  approveContent, 
  rejectContent, 
  revokeApproval, 
  deleteContent,
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

// New interfaces for creator analytics
interface CreatorStats {
  creator_id: string
  creator_name: string
  total_films: number
  total_views: number
  total_purchases: number
  total_revenue: number
  total_earnings: number
  pending_films: number
  approved_films: number
  rejected_films: number
  total_signups?: number
  signup_date?: string
  last_active?: string
  email?: string
  phone?: string
}

interface CreatorDetail extends CreatorStats {
  films: Content[]
  transactions: Transaction[]
  payouts: PayoutRequest[]
  total_payouts_processed: number
  pending_payout_amount: number
  average_price: number
  most_popular_film: string | null
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
    totalCreators: 0,
    totalViews: 0,
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

  // New state for creator analytics
  const [creatorStats, setCreatorStats] = useState<CreatorStats[]>([])
  const [selectedCreator, setSelectedCreator] = useState<CreatorDetail | null>(null)
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false)
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('')
  const [creatorSortBy, setCreatorSortBy] = useState<'name' | 'revenue' | 'films' | 'views'>('revenue')

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
        const allContent = result.content || []
        setContent(allContent)
        setFilteredContent(allContent)
      }

      const { data: payoutData } = await supabase
        .from('payout_requests')
        .select('*, profiles(full_name)')
        .order('requested_at', { ascending: false })
      setPayouts(payoutData || [])

      const { data: transactionsData } = await supabase
        .from('purchases')
        .select('*, content:content_id(title), buyer:buyer_id(email)')
        .order('created_at', { ascending: false })
      setTransactions(transactionsData || [])

      // Fetch creator profiles for analytics
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, created_at, last_seen')
        .order('full_name')

      // Calculate creator stats
      const creatorMap = new Map<string, CreatorStats>()
      const allContent = result.content || []

      // Initialize stats for all creators
      profilesData?.forEach((profile: any) => {
        creatorMap.set(profile.id, {
          creator_id: profile.id,
          creator_name: profile.full_name || 'Unknown',
          total_films: 0,
          total_views: 0,
          total_purchases: 0,
          total_revenue: 0,
          total_earnings: 0,
          pending_films: 0,
          approved_films: 0,
          rejected_films: 0,
          email: profile.email,
          phone: profile.phone,
          signup_date: profile.created_at,
          last_active: profile.last_seen,
        })
      })

      // Process content data
      allContent.forEach((item: any) => {
        const creator = creatorMap.get(item.creator_id)
        if (creator) {
          creator.total_films++
          creator.total_views += item.views || 0
          creator.total_purchases += item.purchase_count || 0
          creator.total_revenue += (item.price * (item.purchase_count || 0))
          
          if (item.status === 'pending') creator.pending_films++
          else if (item.status === 'approved') creator.approved_films++
          else if (item.status === 'rejected') creator.rejected_films++
        }
      })

      // Process earnings from purchases
      transactionsData?.forEach((tx: any) => {
        if (tx.content) {
          const creator = creatorMap.get(tx.content.creator_id)
          if (creator) {
            creator.total_earnings += tx.creator_earnings || 0
          }
        }
      })

      const creatorStatsArray = Array.from(creatorMap.values())
      setCreatorStats(creatorStatsArray)

      // Update total stats
      const totalFilms = allContent.length
      const totalSales = allContent.reduce((sum: number, c: any) => sum + (c.purchase_count || 0), 0)
      const totalRevenue = allContent.reduce((sum: number, c: any) => sum + (c.price * (c.purchase_count || 0)), 0)
      const pendingSubmissions = allContent.filter((c: any) => c.status === 'pending').length
      const totalViews = allContent.reduce((sum: number, c: any) => sum + (c.views || 0), 0)
      
      const { data: purchases } = await supabase.from('purchases').select('platform_fee, creator_earnings')
      const totalPlatformFees = purchases?.reduce((sum, p) => sum + (p.platform_fee || 0), 0) || 0
      const totalPaidToCreators = purchases?.reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0
      
      const { data: pendingPayoutsData } = await supabase.from('payout_requests').select('amount').eq('status', 'pending')
      const pendingPayouts = pendingPayoutsData?.reduce((sum, p) => sum + p.amount, 0) || 0

      setStats({
        totalFilms,
        totalSales,
        totalRevenue,
        totalPlatformFees,
        totalPaidToCreators,
        pendingPayouts,
        pendingSubmissions,
        totalCreators: creatorStatsArray.length,
        totalViews,
      })
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const result = await approveContent(id)
      if (result.success) {
        alert('✅ Content approved successfully!')
        loadAdminData()
      } else {
        alert('❌ Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('❌ Failed to approve content')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const result = await rejectContent(id)
      if (result.success) {
        alert('✅ Content rejected.')
        loadAdminData()
      } else {
        alert('❌ Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('❌ Failed to reject content')
    }
  }

  const handleRevokeApproval = async (id: string) => {
    if (!confirm('Revoke approval for this film?')) return
    try {
      const result = await revokeApproval(id)
      if (result.success) {
        alert('✅ Approval revoked.')
        loadAdminData()
      } else {
        alert('❌ Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('❌ Failed to revoke approval')
    }
  }

  const handleDeleteContent = async (id: string) => {
    if (!confirm('Delete this film permanently?')) return
    try {
      const result = await deleteContent(id)
      if (result.success) {
        alert('✅ Content deleted.')
        loadAdminData()
      } else {
        alert('❌ Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('❌ Failed to delete content')
    }
  }

  const handleMarkPayoutPaid = async (id: string) => {
    if (!confirm('Mark this payout as paid?')) return
    try {
      const result = await processPayout(id)
      if (result.success) {
        alert('✅ Payout marked as processed.')
        loadAdminData()
      } else {
        alert('❌ Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('❌ Failed to process payout')
    }
  }

  const handleConfirmTransaction = async () => {
    if (!selectedTransaction || !confirmationCode.trim()) {
      setConfirmMessage('Please enter a confirmation code')
      return
    }
    setConfirmLoading(true)
    try {
      const result = await confirmTransaction(selectedTransaction.id, confirmationCode.trim())
      if (result.success) {
        setConfirmMessage('✅ Transaction confirmed successfully!')
        setTimeout(() => {
          setIsConfirmModalOpen(false)
          setConfirmationCode('')
          setSelectedTransaction(null)
          setConfirmMessage('')
          loadAdminData()
        }, 1500)
      } else {
        setConfirmMessage('❌ Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      setConfirmMessage('❌ Failed to confirm')
    } finally {
      setConfirmLoading(false)
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

  const openConfirmModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setConfirmationCode('')
    setConfirmMessage('')
    setIsConfirmModalOpen(true)
  }

  // New function to open creator detail modal
  const openCreatorDetail = async (creatorId: string) => {
    const creator = creatorStats.find(c => c.creator_id === creatorId)
    if (!creator) return

    // Fetch all content by this creator
    const creatorContent = content.filter(c => c.creator_id === creatorId)
    
    // Fetch transactions for this creator's content
    const creatorContentIds = creatorContent.map(c => c.id)
    const creatorTransactions = transactions.filter(t => 
      t.content_id && creatorContentIds.includes(t.content_id)
    )
    
    // Fetch payouts for this creator
    const creatorPayouts = payouts.filter(p => p.creator_id === creatorId)
    
    // Calculate additional stats
    const totalPayoutsProcessed = creatorPayouts
      .filter(p => p.status === 'processed')
      .reduce((sum, p) => sum + p.amount, 0)
    
    const pendingPayoutAmount = creatorPayouts
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0)
    
    const avgPrice = creatorContent.length > 0 
      ? creatorContent.reduce((sum, c) => sum + c.price, 0) / creatorContent.length 
      : 0
    
    const mostPopularFilm = creatorContent.length > 0
      ? creatorContent.reduce((a, b) => (a.purchase_count || 0) > (b.purchase_count || 0) ? a : b)
      : null

    const creatorDetail: CreatorDetail = {
      ...creator,
      films: creatorContent,
      transactions: creatorTransactions,
      payouts: creatorPayouts,
      total_payouts_processed: totalPayoutsProcessed,
      pending_payout_amount: pendingPayoutAmount,
      average_price: avgPrice,
      most_popular_film: mostPopularFilm?.title || null,
    }

    setSelectedCreator(creatorDetail)
    setIsCreatorModalOpen(true)
  }

  // Filter and sort creator stats
  const filteredCreators = useMemo(() => {
    let filtered = [...creatorStats]
    
    if (creatorSearchTerm) {
      const term = creatorSearchTerm.toLowerCase()
      filtered = filtered.filter(c => 
        c.creator_name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      )
    }
    
    // Sort creators
    filtered.sort((a, b) => {
      switch (creatorSortBy) {
        case 'name': return a.creator_name.localeCompare(b.creator_name)
        case 'revenue': return b.total_revenue - a.total_revenue
        case 'films': return b.total_films - a.total_films
        case 'views': return b.total_views - a.total_views
        default: return 0
      }
    })
    
    return filtered
  }, [creatorStats, creatorSearchTerm, creatorSortBy])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Loading...</p>
        </div>
      </div>
    )
  }

  const filteredPayouts = payouts.filter((p) => {
    if (payoutFilter === 'all') return true
    return p.status === payoutFilter
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Panel</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Manage content, approvals, and payouts.</p>
        </div>

        {/* Stats Grid - Added Creators and Views */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Films</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5">{stats.totalFilms}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Creators</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-purple-400">{stats.totalCreators}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Views</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-cyan-400">{stats.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Sales</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-blue-400">{stats.totalSales}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Revenue</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-green-400">KES {stats.totalRevenue}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Fees</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-yellow-400">KES {stats.totalPlatformFees}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Paid</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-purple-400">KES {stats.totalPaidToCreators}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Payouts</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-orange-400">KES {stats.pendingPayouts}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-yellow-500/20 bg-yellow-500/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Pending</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-yellow-400">{stats.pendingSubmissions}</p>
          </div>
        </div>

        {/* Pending Alert */}
        {stats.pendingSubmissions > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-yellow-400 text-xs sm:text-sm">
              <span className="font-bold">{stats.pendingSubmissions}</span> project{stats.pendingSubmissions > 1 ? 's' : ''} awaiting approval.
            </p>
          </div>
        )}

        {/* Creator Analytics Section - NEW */}
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
                    <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Films</th>
                    <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden md:table-cell">Views</th>
                    <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Revenue</th>
                    <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden lg:table-cell">Earnings</th>
                    <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Status</th>
                    <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCreators.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No creators found.</td>
                    </tr>
                  ) : (
                    filteredCreators.map((creator) => (
                      <tr key={creator.creator_id} className="hover:bg-white/5 transition cursor-pointer" onClick={() => openCreatorDetail(creator.creator_id)}>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#f5c518]/20 flex items-center justify-center text-[#f5c518] text-xs sm:text-sm font-bold">
                              {creator.creator_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs sm:text-sm font-medium truncate max-w-[80px] sm:max-w-[120px]">{creator.creator_name}</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[100px]">{creator.email || 'N/A'}</td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-xs sm:text-sm">
                          <span className="font-semibold">{creator.total_films}</span>
                          <span className="text-gray-500 text-[8px] sm:text-xs ml-1">
                            ({creator.pending_films > 0 && `${creator.pending_films} pending`}
                            {creator.pending_films > 0 && creator.approved_films > 0 && ', '}
                            {creator.approved_films > 0 && `${creator.approved_films} approved`})
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-400 text-xs hidden md:table-cell">
                          {creator.total_views.toLocaleString()}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right font-semibold text-green-400 text-xs sm:text-sm">
                          KES {creator.total_revenue}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right font-semibold text-yellow-400 text-xs sm:text-sm hidden lg:table-cell">
                          KES {creator.total_earnings}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {creator.approved_films > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>}
                            {creator.pending_films > 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>}
                            {creator.rejected_films > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>}
                            {creator.total_films === 0 && <span className="text-gray-500 text-[8px]">—</span>}
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openCreatorDetail(creator.creator_id); }}
                            className="bg-[#f5c518] text-black px-2 sm:px-3 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-semibold hover:bg-[#e0b010] transition whitespace-nowrap"
                          >
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center mb-4 sm:mb-6">
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected'] as ContentStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg text-[10px] sm:text-sm font-medium transition ${
                  statusFilter === status
                    ? 'bg-[#f5c518] text-black'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status === 'pending' && stats.pendingSubmissions > 0 && (
                  <span className="ml-1 sm:ml-2 bg-yellow-500/20 text-yellow-400 px-1 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs">
                    {stats.pendingSubmissions}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="w-full sm:flex-1 min-w-[150px] sm:min-w-[200px]">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Content Table */}
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
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No content found.</td>
                  </tr>
                ) : (
                  filteredContent.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition">
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                        <div className="flex items-center gap-1.5 sm:gap-3">
                          <div className="w-6 h-8 sm:w-8 sm:h-10 md:w-10 md:h-14 bg-[#0a0a0a] rounded overflow-hidden flex-shrink-0">
                            {item.thumbnail_url && <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />}
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
                          item.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                        <div className="flex gap-1 sm:gap-2 flex-wrap">
                          <button onClick={() => openPreview(item)} className="text-[#f5c518] hover:underline text-[8px] sm:text-xs font-semibold">Preview</button>
                          {item.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(item.id)} className="text-green-400 hover:underline text-[8px] sm:text-xs font-semibold">Approve</button>
                              <button onClick={() => handleReject(item.id)} className="text-red-400 hover:underline text-[8px] sm:text-xs font-semibold">Reject</button>
                            </>
                          )}
                          {item.status === 'approved' && (
                            <button onClick={() => handleRevokeApproval(item.id)} className="text-yellow-400 hover:underline text-[8px] sm:text-xs font-semibold">Revoke</button>
                          )}
                          <button onClick={() => handleDeleteContent(item.id)} className="text-gray-500 hover:text-red-500 transition">
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

        {/* Payouts Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Payout Requests</h2>
          <select 
            value={payoutFilter} 
            onChange={(e) => setPayoutFilter(e.target.value as any)}
            className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm outline-none w-full sm:w-auto"
          >
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
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No payout requests.</td>
                  </tr>
                ) : (
                  filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-white/5 transition">
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-xs">{payout.profiles?.full_name || 'Unknown'}</td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 font-semibold text-green-400 text-xs sm:text-sm">KES {payout.amount}</td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell">{payout.phone}</td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                        <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${
                          payout.status === 'processed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {payout.status === 'processed' ? '✅ Paid' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                        {payout.status === 'pending' && (
                          <button onClick={() => handleMarkPayoutPaid(payout.id)} className="bg-[#f5c518] text-black px-1.5 sm:px-3 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-semibold hover:bg-[#e0b010] transition">Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transactions Section */}
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
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition">
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-xs truncate max-w-[80px] sm:max-w-[120px]">{tx.content?.title || 'N/A'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[100px]">{tx.buyer?.email || 'Unknown'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-[#f5c518] font-semibold text-xs hidden md:table-cell">KES {tx.amount_paid}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-[8px] sm:text-xs font-mono hidden lg:table-cell truncate max-w-[80px]">{tx.pesapal_transaction_id || '—'}</td>
                    <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3">
                      {tx.status !== 'completed' && (
                        <button onClick={() => openConfirmModal(tx)} className="bg-[#f5c518] text-black px-1.5 sm:px-3 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-semibold hover:bg-[#e0b010] transition">Confirm</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Modal */}
        {isPreviewOpen && previewFilm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-white/10">
              <div className="sticky top-0 bg-[#1a1a1a] px-3 sm:px-4 md:px-6 py-2.5 sm:py-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-sm sm:text-base md:text-xl font-bold truncate max-w-[200px] sm:max-w-[300px]">{previewFilm.title}</h2>
                <button onClick={closePreview} className="text-gray-400 hover:text-white transition p-1">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                <div className="aspect-video bg-[#0a0a0a] rounded-lg sm:rounded-xl overflow-hidden">
                  <iframe src={getEmbedUrl(previewFilm.video_url)} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <h3 className="text-xs sm:text-sm text-gray-400">Description</h3>
                    <p className="mt-1 text-xs sm:text-sm">{previewFilm.description || 'No description.'}</p>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div><span className="text-xs sm:text-sm text-gray-400">Creator:</span> <span className="ml-2 text-xs sm:text-sm">{previewFilm.creator_name || 'Unknown'}</span></div>
                    <div><span className="text-xs sm:text-sm text-gray-400">Price:</span> <span className="ml-2 text-[#f5c518] font-bold text-xs sm:text-sm">KES {previewFilm.price}</span></div>
                    <div><span className="text-xs sm:text-sm text-gray-400">Status:</span> <span className="ml-2 text-xs sm:text-sm">{previewFilm.status}</span></div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-white/10">
                  {previewFilm.status === 'pending' && (
                    <>
                      <button onClick={() => { handleApprove(previewFilm.id); closePreview(); }} className="flex-1 bg-green-500 text-white py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition">Approve</button>
                      <button onClick={() => { handleReject(previewFilm.id); closePreview(); }} className="flex-1 bg-red-500 text-white py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition">Reject</button>
                    </>
                  )}
                  <button onClick={closePreview} className="flex-1 border border-white/20 py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-white/5 transition">Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Creator Detail Modal - NEW */}
        {isCreatorModalOpen && selectedCreator && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-white/10">
              {/* Modal Header */}
              <div className="sticky top-0 bg-[#1a1a1a] px-3 sm:px-4 md:px-6 py-2.5 sm:py-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#f5c518]/20 flex items-center justify-center text-[#f5c518] text-sm sm:text-base font-bold">
                    {selectedCreator.creator_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg md:text-xl font-bold">{selectedCreator.creator_name}</h2>
                    <p className="text-gray-400 text-xs sm:text-sm">{selectedCreator.email || 'No email'}</p>
                  </div>
                </div>
                <button onClick={() => setIsCreatorModalOpen(false)} className="text-gray-400 hover:text-white transition p-1">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                {/* Creator Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div className="bg-[#0a0a0a] rounded-lg p-2.5 sm:p-3">
                    <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider">Total Films</p>
                    <p className="text-lg sm:text-xl font-bold mt-0.5">{selectedCreator.total_films}</p>
                    <div className="flex gap-1 mt-1 text-[8px] sm:text-[10px]">
                      <span className="text-green-400">✓{selectedCreator.approved_films}</span>
                      <span className="text-yellow-400">⏳{selectedCreator.pending_films}</span>
                      <span className="text-red-400">✕{selectedCreator.rejected_films}</span>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-2.5 sm:p-3">
                    <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider">Total Views</p>
                    <p className="text-lg sm:text-xl font-bold mt-0.5 text-cyan-400">{selectedCreator.total_views.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-2.5 sm:p-3">
                    <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider">Revenue</p>
                    <p className="text-lg sm:text-xl font-bold mt-0.5 text-green-400">KES {selectedCreator.total_revenue}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Avg: KES {Math.round(selectedCreator.average_price)}</p>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-2.5 sm:p-3">
                    <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider">Earnings</p>
                    <p className="text-lg sm:text-xl font-bold mt-0.5 text-yellow-400">KES {selectedCreator.total_earnings}</p>
                    <p className="text-[8px] sm:text-[10px] text-gray-500">Paid: KES {selectedCreator.total_payouts_processed}</p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-[#0a0a0a] rounded-lg p-3 sm:p-4">
                    <h4 className="text-xs sm:text-sm font-semibold mb-2">Payout Information</h4>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p><span className="text-gray-400">Pending Payouts:</span> <span className="text-orange-400">KES {selectedCreator.pending_payout_amount}</span></p>
                      <p><span className="text-gray-400">Total Payouts:</span> <span className="text-green-400">KES {selectedCreator.total_payouts_processed}</span></p>
                      <p><span className="text-gray-400">Phone:</span> {selectedCreator.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] rounded-lg p-3 sm:p-4">
                    <h4 className="text-xs sm:text-sm font-semibold mb-2">Creator Details</h4>
                    <div className="space-y-1 text-xs sm:text-sm">
                      <p><span className="text-gray-400">Member Since:</span> {selectedCreator.signup_date ? new Date(selectedCreator.signup_date).toLocaleDateString() : 'N/A'}</p>
                      <p><span className="text-gray-400">Last Active:</span> {selectedCreator.last_active ? new Date(selectedCreator.last_active).toLocaleDateString() : 'N/A'}</p>
                      <p><span className="text-gray-400">Most Popular:</span> <span className="text-[#f5c518]">{selectedCreator.most_popular_film || 'N/A'}</span></p>
                    </div>
                  </div>
                </div>

                {/* Creator's Films */}
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold mb-2">Films by {selectedCreator.creator_name}</h4>
                  <div className="bg-[#0a0a0a] rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-[#0a0a0a] border-b border-white/5">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Title</th>
                            <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider hidden sm:table-cell">Price</th>
                            <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Views</th>
                            <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider hidden md:table-cell">Sales</th>
                            <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {selectedCreator.films.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-4 text-center text-gray-500">No films found</td>
                            </tr>
                          ) : (
                            selectedCreator.films.map((film) => (
                              <tr key={film.id} className="hover:bg-white/5 transition">
                                <td className="px-2 sm:px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    {film.thumbnail_url && (
                                      <img src={film.thumbnail_url} alt="" className="w-6 h-8 sm:w-8 sm:h-10 object-cover rounded" />
                                    )}
                                    <span className="truncate max-w-[80px] sm:max-w-[150px]">{film.title}</span>
                                  </div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 hidden sm:table-cell">KES {film.price}</td>
                                <td className="px-2 sm:px-4 py-2">{film.views}</td>
                                <td className="px-2 sm:px-4 py-2 hidden md:table-cell">{film.purchase_count}</td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${
                                    film.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                    film.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                  }`}>
                                    {film.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Payout History for this Creator */}
                {selectedCreator.payouts.length > 0 && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold mb-2">Payout History</h4>
                    <div className="bg-[#0a0a0a] rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-[#0a0a0a] border-b border-white/5">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Amount</th>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {selectedCreator.payouts.map((payout) => (
                              <tr key={payout.id} className="hover:bg-white/5 transition">
                                <td className="px-2 sm:px-4 py-2 font-semibold text-green-400">KES {payout.amount}</td>
                                <td className="px-2 sm:px-4 py-2 text-gray-400 hidden sm:table-cell">
                                  {new Date(payout.requested_at).toLocaleDateString()}
                                </td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${
                                    payout.status === 'processed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {payout.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Transaction History for this Creator */}
                {selectedCreator.transactions.length > 0 && (
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold mb-2">Recent Purchases</h4>
                    <div className="bg-[#0a0a0a] rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                          <thead className="bg-[#0a0a0a] border-b border-white/5">
                            <tr>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Buyer</th>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider hidden sm:table-cell">Amount</th>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Earnings</th>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider hidden md:table-cell">Date</th>
                              <th className="px-2 sm:px-4 py-2 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {selectedCreator.transactions.slice(0, 10).map((tx) => (
                              <tr key={tx.id} className="hover:bg-white/5 transition">
                                <td className="px-2 sm:px-4 py-2 truncate max-w-[80px] sm:max-w-[120px]">{tx.buyer?.email || 'Unknown'}</td>
                                <td className="px-2 sm:px-4 py-2 hidden sm:table-cell text-[#f5c518]">KES {tx.amount_paid}</td>
                                <td className="px-2 sm:px-4 py-2 text-yellow-400">KES {tx.creator_earnings}</td>
                                <td className="px-2 sm:px-4 py-2 text-gray-400 hidden md:table-cell">
                                  {new Date(tx.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-2 sm:px-4 py-2">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${
                                    tx.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {tx.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {selectedCreator.transactions.length > 10 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-2 text-center text-gray-500 text-xs">
                                  + {selectedCreator.transactions.length - 10} more transactions
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Close button */}
                <div className="flex justify-end pt-3 sm:pt-4 border-t border-white/10">
                  <button 
                    onClick={() => setIsCreatorModalOpen(false)} 
                    className="border border-white/20 px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-white/5 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {isConfirmModalOpen && selectedTransaction && (
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
                {confirmMessage && (
                  <div className={`p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
                    confirmMessage.includes('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {confirmMessage}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2 sm:pt-4">
                  <button 
                    onClick={() => setIsConfirmModalOpen(false)} 
                    className="flex-1 border border-white/20 py-1.5 sm:py-2 rounded-lg font-semibold transition text-sm hover:bg-white/5 order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmTransaction} 
                    disabled={confirmLoading} 
                    className="flex-1 bg-[#f5c518] text-black py-1.5 sm:py-2 rounded-lg font-semibold transition disabled:opacity-50 text-sm order-1 sm:order-2"
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
