'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getAllContent,
  approveContent,
  rejectContent,
  revokeApproval,
  deleteContent,
  confirmTransaction,
  processPayout,
} from '@/app/actions/admin'
import type {
  Content, PayoutRequest, Transaction, CreatorStats,
  ActivityLog, MonthlyReport, Stats, ContentStatus,
} from '../types'

export function useAdminData() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [content, setContent] = useState<Content[]>([])
  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [creatorStats, setCreatorStats] = useState<CreatorStats[]>([])
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport[]>([])

  const [stats, setStats] = useState<Stats>({
    totalFilms: 0, totalSales: 0, totalRevenue: 0, totalPlatformFees: 0,
    totalPaidToCreators: 0, pendingPayouts: 0, pendingSubmissions: 0,
    totalCreators: 0, totalViews: 0, flaggedContent: 0,
  })

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // ---- filters (kept here so components can be dumb/presentational) ----
  const [statusFilter, setStatusFilter] = useState<ContentStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('')
  const [creatorSortBy, setCreatorSortBy] = useState<'name' | 'revenue' | 'films' | 'views'>('revenue')
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'pending' | 'processed'>('all')

  const logAdminAction = useCallback(async (action: string, targetId: string, targetType: string, details?: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('admin_activity_logs').insert({
        admin_id: session?.user.id,
        action,
        target_id: targetId,
        target_type: targetType,
        details: details || {},
      })
    } catch (error) {
      console.error('Error logging action:', error)
    }
  }, [supabase])

  const loadActivityLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*, admin:admin_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading activity logs:', error)
        setActivityLogs([])
        return
      }
      setActivityLogs(data || [])
    } catch (error) {
      console.error('Error loading activity logs:', error)
      setActivityLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }, [supabase])

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

      // These four fetches are independent of each other — run them
      // concurrently instead of sequentially to cut load time.
      const [contentResult, payoutRes, txRes, profilesRes] = await Promise.all([
        getAllContent(),
        supabase.from('payout_requests').select('*, profiles(full_name)').order('requested_at', { ascending: false }),
        supabase.from('purchases').select('*, content:content_id(title, creator_id), buyer:buyer_id(email)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, phone_number, is_onboarded, has_phone, has_payout_method, created_at, last_seen, total_earnings').order('full_name'),
      ])

      const allContent = contentResult.content || []
      setContent(allContent)
      if (contentResult.error) console.error('Error fetching content:', contentResult.error)

      setPayouts(payoutRes.data || [])

      const transactionsData = txRes.data || []
      setTransactions(transactionsData)

      const completedTransactions = transactionsData.filter((tx: any) => tx.status === 'completed')

      // ---- monthly report ----
      if (completedTransactions.length > 0) {
        const monthlyData: { [key: string]: MonthlyReport } = {}
        completedTransactions.forEach((tx: any) => {
          const date = new Date(tx.created_at)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          const monthName = date.toLocaleString('default', { month: 'long' })
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month: monthName, year: date.getFullYear(),
              total_transactions: 0, total_revenue: 0, total_fees: 0,
              total_earnings: 0, unique_buyers: 0, unique_films: 0,
            }
          }
          monthlyData[monthKey].total_transactions += 1
          monthlyData[monthKey].total_revenue += Number(tx.amount_paid || 0)
          monthlyData[monthKey].total_fees += Number(tx.platform_fee || 0)
          monthlyData[monthKey].total_earnings += Number(tx.creator_earnings || 0)
        })

        const monthlyArray = Object.keys(monthlyData).sort().map((key) => {
          const data = monthlyData[key]
          const buyers = new Set()
          const films = new Set()
          completedTransactions
            .filter((tx: any) => {
              const date = new Date(tx.created_at)
              const txKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              return txKey === key
            })
            .forEach((tx: any) => {
              if (tx.buyer_id) buyers.add(tx.buyer_id)
              if (tx.content_id) films.add(tx.content_id)
            })
          return { ...data, unique_buyers: buyers.size, unique_films: films.size }
        })
        setMonthlyReport(monthlyArray)
      } else {
        setMonthlyReport([])
      }

      // ---- creator stats ----
      const profilesData = profilesRes.data || []
      const creatorMap = new Map<string, CreatorStats>()

      profilesData.forEach((profile: any) => {
        creatorMap.set(profile.id, {
          creator_id: profile.id,
          creator_name: profile.full_name || 'Unknown',
          total_films: 0, total_views: 0, total_purchases: 0,
          total_revenue: 0, total_earnings: 0,
          pending_films: 0, approved_films: 0, rejected_films: 0,
          email: profile.email, phone: profile.phone_number,
          signup_date: profile.created_at, last_active: profile.last_seen,
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

      completedTransactions.forEach((tx: any) => {
        if (tx.content) {
          const creator = creatorMap.get(tx.content.creator_id)
          if (creator) creator.total_earnings += Number(tx.creator_earnings || 0)
        }
      })

      const creatorStatsArray = Array.from(creatorMap.values())
      setCreatorStats(creatorStatsArray)

      // ---- top stats ----
      const totalFilms = allContent.length
      const totalSales = allContent.reduce((sum: number, c: any) => sum + (c.purchase_count || 0), 0)
      const totalRevenue = completedTransactions.reduce((sum: number, tx: any) => sum + Number(tx.amount_paid || 0), 0)
      const totalPlatformFees = completedTransactions.reduce((sum: number, tx: any) => sum + Number(tx.platform_fee || 0), 0)
      const totalPaidToCreators = completedTransactions.reduce((sum: number, tx: any) => sum + Number(tx.creator_earnings || 0), 0)
      const pendingSubmissions = allContent.filter((c: any) => c.status === 'pending').length
      const totalViews = allContent.reduce((sum: number, c: any) => sum + (c.views || 0), 0)
      const flaggedContent = allContent.filter((c: any) => c.flagged || false).length

      const { data: pendingPayoutsData } = await supabase.from('payout_requests').select('amount').eq('status', 'pending')
      const pendingPayouts = pendingPayoutsData?.reduce((sum, p) => sum + p.amount, 0) || 0

      setStats({
        totalFilms, totalSales, totalRevenue, totalPlatformFees, totalPaidToCreators,
        pendingPayouts, pendingSubmissions, totalCreators: creatorStatsArray.length,
        totalViews, flaggedContent,
      })
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => { loadAdminData() }, [loadAdminData])

  const refreshData = useCallback(async () => {
    setRefreshing(true)
    await loadAdminData()
    setRefreshing(false)
  }, [loadAdminData])

  // ---- derived/filtered data (memoized so filtering doesn't re-run on unrelated re-renders) ----
  const filteredContent = useMemo(() => {
    let filtered = [...content]
    if (statusFilter !== 'all') filtered = filtered.filter((c) => c.status === statusFilter)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((c) =>
        c.title.toLowerCase().includes(term) ||
        (c.creator_name?.toLowerCase() || '').includes(term)
      )
    }
    if (dateRange.start) filtered = filtered.filter(c => c.created_at >= dateRange.start)
    if (dateRange.end) filtered = filtered.filter(c => c.created_at <= dateRange.end)
    return filtered
  }, [content, statusFilter, searchTerm, dateRange])

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

  const filteredPayouts = useMemo(() => {
    if (payoutFilter === 'all') return payouts
    return payouts.filter((p) => p.status === payoutFilter)
  }, [payouts, payoutFilter])

  // ---- mutations ----
  const handleApprove = useCallback(async (id: string) => {
    const result = await approveContent(id)
    if (result.success) {
      await logAdminAction('content_approve', id, 'content', { status: 'approved' })
      await loadAdminData()
    }
    return result
  }, [loadAdminData, logAdminAction])

  const handleReject = useCallback(async (id: string) => {
    const result = await rejectContent(id)
    if (result.success) {
      await logAdminAction('content_reject', id, 'content', { status: 'rejected' })
      await loadAdminData()
    }
    return result
  }, [loadAdminData, logAdminAction])

  const handleRevokeApproval = useCallback(async (id: string) => {
    const result = await revokeApproval(id)
    if (result.success) {
      await logAdminAction('content_revoke', id, 'content', { status: 'revoked' })
      await loadAdminData()
    }
    return result
  }, [loadAdminData, logAdminAction])

  const handleDeleteContent = useCallback(async (id: string) => {
    const result = await deleteContent(id)
    if (result.success) {
      await logAdminAction('content_delete', id, 'content', { deleted: true })
      await loadAdminData()
    }
    return result
  }, [loadAdminData, logAdminAction])

  const handleMarkPayoutPaid = useCallback(async (id: string) => {
    const result = await processPayout(id)
    if (result.success) {
      await logAdminAction('payout_processed', id, 'payout', { status: 'processed' })
      await loadAdminData()
    }
    return result
  }, [loadAdminData, logAdminAction])

  // ✅ Now goes through the secured server action instead of a raw client-side
  // Supabase write — admin status and fee calculation happen server-side.
  // Note: Platform fee is now 30% (70% to creators, 30% to platform)
  const handleConfirmTransaction = useCallback(async (transactionId: string, confirmationCode: string) => {
    const result = await confirmTransaction(transactionId, confirmationCode)
    if (result.success) {
      await logAdminAction('transaction_confirm', transactionId, 'transaction', { confirmation_code: confirmationCode })
      await loadAdminData()
    }
    return result
  }, [loadAdminData, logAdminAction])

  return {
    loading, refreshing, refreshData,
    content, filteredContent,
    payouts, filteredPayouts,
    transactions,
    creatorStats, filteredCreators,
    monthlyReport,
    stats,
    activityLogs, loadingLogs, loadActivityLogs,
    statusFilter, setStatusFilter,
    searchTerm, setSearchTerm,
    dateRange, setDateRange,
    creatorSearchTerm, setCreatorSearchTerm,
    creatorSortBy, setCreatorSortBy,
    payoutFilter, setPayoutFilter,
    handleApprove, handleReject, handleRevokeApproval, handleDeleteContent,
    handleMarkPayoutPaid, handleConfirmTransaction,
  }
}
