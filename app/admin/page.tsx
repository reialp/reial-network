'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
  content: { title: string; creator_id: string } | null
  buyer: { email: string } | null
}

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
  email?: string
  phone?: string
  signup_date?: string
  last_active?: string
  is_onboarded?: boolean
  has_phone?: boolean
  has_payout_method?: boolean
}

interface ActivityLog {
  id: string
  admin_id: string
  action: string
  target_id: string
  target_type: string
  details: any
  created_at: string
  admin: {
    full_name: string
  }
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [content, setContent] = useState<Content[]>([])
  const [filteredContent, setFilteredContent] = useState<Content[]>([])
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [creatorStats, setCreatorStats] = useState<CreatorStats[]>([])
  
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
    flaggedContent: 0,
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

  const [creatorSearchTerm, setCreatorSearchTerm] = useState('')
  const [creatorSortBy, setCreatorSortBy] = useState<'name' | 'revenue' | 'films' | 'views'>('revenue')
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({
    start: '',
    end: ''
  })

  const [showActivityLogs, setShowActivityLogs] = useState(false)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const PLATFORM_FEE_PERCENTAGE = 0.15

  // Load Activity Logs with better error handling
  const loadActivityLogs = async () => {
    setLoadingLogs(true)
    try {
      // Check if table exists first
      const { error: tableCheckError } = await supabase
        .from('admin_activity_logs')
        .select('id')
        .limit(1)
      
      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist
        setActivityLogs([])
        setShowActivityLogs(true)
        alert('Activity logs table not found. Please run the SQL migration.')
        setLoadingLogs(false)
        return
      }

      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*, admin:admin_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setActivityLogs(data || [])
      setShowActivityLogs(true)
    } catch (error: any) {
      console.error('Error loading activity logs:', error)
      // Don't show alert, just show empty state
      setActivityLogs([])
      setShowActivityLogs(true)
    } finally {
      setLoadingLogs(false)
    }
  }

  const logAdminAction = async (action: string, targetId: string, targetType: string, details?: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase
        .from('admin_activity_logs')
        .insert({
          admin_id: session?.user.id,
          action: action,
          target_id: targetId,
          target_type: targetType,
          details: details || {}
        })
    } catch (error) {
      console.error('Error logging action:', error)
    }
  }

  // Improved Export CSV with better formatting
  const exportCSV = () => {
    try {
      // Create headers
      const headers = [
        'Title',
        'Creator', 
        'Price (KES)',
        'Status',
        'Views',
        'Sales',
        'Revenue (KES)',
        'Created At'
      ]
      
      // Create rows with better data
      const rows = filteredContent.map(item => [
        `"${item.title}"`,
        `"${item.creator_name || 'Unknown'}"`,
        item.price,
        item.status,
        item.views || 0,
        item.purchase_count || 0,
        item.price * (item.purchase_count || 0),
        new Date(item.created_at).toLocaleDateString()
      ])
      
      // Build CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `content_report_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV')
    }
  }

  const loadAdminData = useCallback(async () => {
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

      // Fetch content
      const result = await getAllContent()
      if (result.error) {
        console.error('Error fetching content:', result.error)
      } else {
        const allContent = result.content || []
        setContent(allContent)
        setFilteredContent(allContent)
      }

      // Fetch payouts
      const { data: payoutData } = await supabase
        .from('payout_requests')
        .select('*, profiles(full_name)')
        .order('requested_at', { ascending: false })
      setPayouts(payoutData || [])

      // Fetch transactions with platform fees
      const { data: transactionsData } = await supabase
        .from('purchases')
        .select('*, content:content_id(title, creator_id), buyer:buyer_id(email)')
        .order('created_at', { ascending: false })
      setTransactions(transactionsData || [])

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, is_onboarded, has_phone, has_payout_method, created_at, last_seen, total_earnings')
        .order('full_name')

      const allContent = result.content || []
      const creatorMap = new Map<string, CreatorStats>()

      profilesData?.forEach((profile: any) => {
        creatorMap.set(profile.id, {
          creator_id: profile.id,
          creator_name: profile.full_name || 'Unknown',
          total_films: 0,
          total_views: 0,
          total_purchases: 0,
          total_revenue: 0,
          total_earnings: Number(profile.total_earnings || 0).toFixed(2),
          pending_films: 0,
          approved_films: 0,
          rejected_films: 0,
          email: profile.email,
          phone: profile.phone_number,
          signup_date: profile.created_at,
          last_active: profile.last_seen,
          is_onboarded: profile.is_onboarded || false,
          has_phone: profile.has_phone || false,
          has_payout_method: profile.has_payout_method || false,
        })
      })

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

      // Calculate creator earnings from transactions
      transactionsData?.forEach((tx: any) => {
        if (tx.content) {
          const creator = creatorMap.get(tx.content.creator_id)
          if (creator) {
            creator.total_earnings = Number(creator.total_earnings || 0) + Number(tx.creator_earnings || 0)
          }
        }
      })

      // Format earnings to 2 decimal places
      const creatorStatsArray = Array.from(creatorMap.values()).map(creator => ({
        ...creator,
        total_earnings: Number(creator.total_earnings).toFixed(2)
      }))
      setCreatorStats(creatorStatsArray)

      // Calculate stats - use Number to avoid floating point issues
      const totalFilms = allContent.length
      const totalSales = allContent.reduce((sum: number, c: any) => sum + (c.purchase_count || 0), 0)
      const totalRevenue = Number(transactionsData?.reduce((sum: number, tx: any) => sum + Number(tx.amount_paid || 0), 0) || 0).toFixed(2)
      const totalPlatformFees = Number(transactionsData?.reduce((sum: number, tx: any) => sum + Number(tx.platform_fee || 0), 0) || 0).toFixed(2)
      const totalPaidToCreators = Number(transactionsData?.reduce((sum: number, tx: any) => sum + Number(tx.creator_earnings || 0), 0) || 0).toFixed(2)
      const pendingSubmissions = allContent.filter((c: any) => c.status === 'pending').length
      const totalViews = allContent.reduce((sum: number, c: any) => sum + (c.views || 0), 0)
      const flaggedContent = allContent.filter((c: any) => c.flagged || false).length
      
      const { data: pendingPayoutsData } = await supabase.from('payout_requests').select('amount').eq('status', 'pending')
      const pendingPayouts = pendingPayoutsData?.reduce((sum, p) => sum + p.amount, 0) || 0

      setStats({
        totalFilms,
        totalSales,
        totalRevenue: Number(totalRevenue),
        totalPlatformFees: Number(totalPlatformFees),
        totalPaidToCreators: Number(totalPaidToCreators),
        pendingPayouts,
        pendingSubmissions,
        totalCreators: creatorStatsArray.length,
        totalViews,
        flaggedContent,
      })

    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  const refreshData = async () => {
    setRefreshing(true)
    await loadAdminData()
    setRefreshing(false)
  }

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  // Filter content when filters change
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
    if (dateRange.start) {
      filtered = filtered.filter(c => c.created_at >= dateRange.start)
    }
    if (dateRange.end) {
      filtered = filtered.filter(c => c.created_at <= dateRange.end)
    }
    setFilteredContent(filtered)
  }, [content, statusFilter, searchTerm, dateRange])

  // Handlers for actions
  const handleApprove = async (id: string) => {
    try {
      const result = await approveContent(id)
      if (result.success) {
        await logAdminAction('content_approve', id, 'content', { status: 'approved' })
        alert('Content approved successfully!')
        await loadAdminData()
      } else {
        alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('Failed to approve content')
    }
  }

  const handleReject = async (id: string) => {
    try {
      const result = await rejectContent(id)
      if (result.success) {
        await logAdminAction('content_reject', id, 'content', { status: 'rejected' })
        alert('Content rejected.')
        await loadAdminData()
      } else {
        alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('Failed to reject content')
    }
  }

  const handleRevokeApproval = async (id: string) => {
    if (!confirm('Revoke approval for this film?')) return
    try {
      const result = await revokeApproval(id)
      if (result.success) {
        await logAdminAction('content_revoke', id, 'content', { status: 'revoked' })
        alert('Approval revoked.')
        await loadAdminData()
      } else {
        alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('Failed to revoke approval')
    }
  }

  const handleDeleteContent = async (id: string) => {
    if (!confirm('Delete this film permanently?')) return
    try {
      const result = await deleteContent(id)
      if (result.success) {
        await logAdminAction('content_delete', id, 'content', { deleted: true })
        alert('Content deleted.')
        await loadAdminData()
      } else {
        alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('Failed to delete content')
    }
  }

  const handleMarkPayoutPaid = async (id: string) => {
    if (!confirm('Mark this payout as paid?')) return
    try {
      const result = await processPayout(id)
      if (result.success) {
        await logAdminAction('payout_processed', id, 'payout', { status: 'processed' })
        alert('Payout marked as processed.')
        await loadAdminData()
      } else {
        alert('Error: ' + (typeof result.error === 'string' ? result.error : JSON.stringify(result.error)))
      }
    } catch (err) {
      alert('Failed to process payout')
    }
  }

  // View Details handler - Opens creator detail
  const viewCreatorDetails = (creatorId: string) => {
    // Navigate to creator detail or open modal
    alert(`Creator details for ID: ${creatorId}\nThis will show full creator analytics.`)
    // You can implement a modal or navigate to a detail page
  }

  const handleConfirmTransaction = async () => {
    if (!selectedTransaction || !confirmationCode.trim()) {
      setConfirmMessage('Please enter a confirmation code')
      return
    }
    setConfirmLoading(true)
    try {
      const { data: txData, error: txError } = await supabase
        .from('purchases')
        .select('*, content:content_id(price, title, creator_id)')
        .eq('id', selectedTransaction.id)
        .single()

      if (txError) throw txError

      const amountPaid = Number(txData.amount_paid || txData.content?.price || 0)
      const platformFee = Number((amountPaid * PLATFORM_FEE_PERCENTAGE).toFixed(2))
      const creatorEarnings = Number((amountPaid - platformFee).toFixed(2))

      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          status: 'completed',
          platform_fee: platformFee,
          creator_earnings: creatorEarnings,
          pesapal_transaction_id: confirmationCode.trim()
        })
        .eq('id', selectedTransaction.id)

      if (updateError) throw updateError

      await logAdminAction('transaction_confirm', selectedTransaction.id, 'transaction', {
        amount: amountPaid,
        platform_fee: platformFee,
        creator_earnings: creatorEarnings,
        fee_percentage: '15%'
      })

      setConfirmMessage('Transaction confirmed successfully!')
      setTimeout(async () => {
        setIsConfirmModalOpen(false)
        setConfirmationCode('')
        setSelectedTransaction(null)
        setConfirmMessage('')
        await loadAdminData()
      }, 1500)
    } catch (err) {
      setConfirmMessage('Error: ' + (err instanceof Error ? err.message : 'Failed to confirm'))
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

  const filteredCreators = useMemo(() => {
    let filtered = [...creatorStats]
    
    if (creatorSearchTerm) {
      const term = creatorSearchTerm.toLowerCase()
      filtered = filtered.filter(c => 
        c.creator_name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      )
    }
    
    filtered.sort((a, b) => {
      switch (creatorSortBy) {
        case 'name': return a.creator_name.localeCompare(b.creator_name)
        case 'revenue': return Number(b.total_revenue) - Number(a.total_revenue)
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin Panel</h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Manage content, approvals, and payouts. (15% Platform Fee)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={refreshData}
              disabled={refreshing}
              className="px-3 py-1.5 bg-[#f5c518] text-black rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 flex items-center gap-1"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                'Refresh Data'
              )}
            </button>
            <button 
              onClick={loadActivityLogs}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs sm:text-sm hover:bg-[#2a2a2a] transition"
            >
              {showActivityLogs ? 'Hide Logs' : 'Activity Logs'}
            </button>
            <button 
              onClick={exportCSV}
              className="px-3 py-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs sm:text-sm hover:bg-[#2a2a2a] transition"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Activity Logs Section */}
        {showActivityLogs && (
          <div className="mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg sm:text-xl font-bold">Activity Logs</h2>
              <button 
                onClick={() => setShowActivityLogs(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden max-h-[400px] overflow-y-auto">
              {loadingLogs ? (
                <div className="p-4 text-center text-gray-400">Loading logs...</div>
              ) : activityLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No activity logs found. 
                  {activityLogs.length === 0 && (
                    <span className="block text-xs text-gray-600 mt-1">
                      Admin actions will appear here once you approve/reject content or process payouts.
                    </span>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="p-3 hover:bg-white/5 transition">
                      <div className="flex items-start gap-3">
                        <div className={`w-1 h-full min-h-[40px] rounded-full ${
                          log.action.includes('approve') ? 'bg-green-500' :
                          log.action.includes('reject') || log.action.includes('delete') ? 'bg-red-500' :
                          log.action.includes('payout') ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm">
                              {log.admin?.full_name || 'System'}
                            </span>
                            <span className="text-gray-400 text-xs">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {log.target_type}
                            </span>
                            <span className="text-gray-500 text-xs ml-auto">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          {log.details && (
                            <div className="text-xs text-gray-400 mt-1">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
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
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-cyan-400">{stats.totalViews}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Sales</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-blue-400">{stats.totalSales}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Revenue</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-green-400">KES {Number(stats.totalRevenue).toFixed(2)}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Fees (15%)</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-yellow-400">KES {Number(stats.totalPlatformFees).toFixed(2)}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-white/5">
            <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase tracking-wider font-medium">Payouts</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-orange-400">KES {Number(stats.pendingPayouts).toFixed(2)}</p>
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

        {/* Creator Analytics Section */}
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
                    <tr>
                      <td colSpan={8} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No creators found.</td>
                    </tr>
                  ) : (
                    filteredCreators.map((creator) => (
                      <tr key={creator.creator_id} className="hover:bg-white/5 transition cursor-pointer">
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
                            {!creator.has_phone && !creator.has_payout_method && (
                              <span className="text-gray-500 text-[8px]">Incomplete</span>
                            )}
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
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-gray-400 text-xs hidden md:table-cell">
                          {creator.total_views}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right font-semibold text-green-400 text-xs sm:text-sm">
                          KES {Number(creator.total_revenue).toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right font-semibold text-yellow-400 text-xs sm:text-sm hidden lg:table-cell">
                          KES {Number(creator.total_earnings).toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-center">
                          <button 
                            onClick={() => viewCreatorDetails(creator.creator_id)}
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
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-xs sm:text-sm outline-none"
              placeholder="Start date"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-2 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-xs sm:text-sm outline-none"
              placeholder="End date"
            />
            <button
              onClick={() => setDateRange({ start: '', end: '' })}
              className="px-2 py-1 text-gray-400 hover:text-white text-xs sm:text-sm"
            >
              Clear
            </button>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-xs sm:text-sm min-w-[120px]"
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
                          {payout.status === 'processed' ? 'Paid' : 'Pending'}
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
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-gray-500 text-xs sm:text-sm">No transactions found.</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
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
                  ))
                )}
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
                    confirmMessage.includes('success') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
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
