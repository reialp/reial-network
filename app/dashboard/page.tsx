'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import OnboardingGuide from '@/components/OnboardingGuide'

interface Content {
  id: string
  title: string
  price: number
  views: number
  purchase_count: number
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_at: string
  slug: string | null
  category: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [content, setContent] = useState<Content[]>([])
  const [stats, setStats] = useState({
    totalFilms: 0,
    pendingApprovals: 0,
    totalSales: 0,
    grossRevenue: 0,
    yourEarnings: 0,
    availableBalance: 0,
    platformFees: 0,
  })
  const [displayName, setDisplayName] = useState('Creator')
  const [loading, setLoading] = useState(true)
  const [isCreator, setIsCreator] = useState(false)

  const [payoutAmount, setPayoutAmount] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [payoutHistory, setPayoutHistory] = useState<any[]>([])
  const [isRequesting, setIsRequesting] = useState(false)
  const [payoutMessage, setPayoutMessage] = useState('')

  const [userId, setUserId] = useState('')
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)

  useEffect(() => {
    loadDashboard()

    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases',
        },
        () => {
          console.log('Purchase detected, refreshing dashboard...')
          loadDashboard()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
        },
        () => {
          console.log('Payout detected, refreshing dashboard...')
          loadDashboard()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadDashboard = async () => {
    setLoading(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }
    setUserId(session.user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, is_creator')
      .eq('id', session.user.id)
      .single()

    if (profile) {
      setDisplayName(profile.full_name || session.user.email?.split('@')[0] || 'Creator')
      setIsCreator(profile.is_creator || false)
    }

    const { data: contentData } = await supabase
      .from('content')
      .select('*')
      .eq('creator_id', session.user.id)
      .order('created_at', { ascending: false })

    setContent(contentData || [])

    const totalFilms = contentData?.length || 0
    const pendingApprovals = contentData?.filter(c => c.status === 'pending').length || 0
    const totalSales = contentData?.reduce((sum, c) => sum + (c.purchase_count || 0), 0) || 0
    const grossRevenue = contentData?.reduce((sum, c) => sum + (c.price * (c.purchase_count || 0)), 0) || 0
    
    const yourEarnings = grossRevenue * 0.70
    const platformFees = grossRevenue * 0.30

    const contentIds = contentData?.map(c => c.id) || []
    
    let totalEarningsFromPurchases = 0
    if (contentIds.length > 0) {
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('creator_earnings')
        .eq('status', 'completed')
        .in('content_id', contentIds)
      
      totalEarningsFromPurchases = purchasesData?.reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0
    }

    const { data: payoutData } = await supabase
      .from('payout_requests')
      .select('amount, status')
      .eq('creator_id', session.user.id)

    const totalPendingPayouts = payoutData?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0) || 0
    const totalProcessedPayouts = payoutData?.filter(p => p.status === 'processed').reduce((sum, p) => sum + p.amount, 0) || 0
    const availableBalance = totalEarningsFromPurchases - totalPendingPayouts - totalProcessedPayouts

    setStats({ 
      totalFilms, 
      pendingApprovals, 
      totalSales, 
      grossRevenue, 
      yourEarnings,
      availableBalance,
      platformFees,
    })

    const { data: historyData } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('creator_id', session.user.id)
      .order('requested_at', { ascending: false })

    setPayoutHistory(historyData || [])
    setLoading(false)
  }

  const handlePayoutRequest = async () => {
    const amount = parseInt(payoutAmount)
    
    if (!payoutAmount || amount < 500) {
      setPayoutMessage('Minimum payout is KES 500')
      return
    }

    if (amount > stats.availableBalance) {
      setPayoutMessage(`You can only request up to KES ${stats.availableBalance.toFixed(2)}. Your available balance is KES ${stats.availableBalance.toFixed(2)}.`)
      return
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      setPayoutMessage('Please enter a valid M-Pesa phone number')
      return
    }

    setIsRequesting(true)
    setPayoutMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setPayoutMessage('Please log in again')
      setIsRequesting(false)
      return
    }

    const { data: pendingPayout } = await supabase
      .from('payout_requests')
      .select('id')
      .eq('creator_id', session.user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pendingPayout) {
      setPayoutMessage('You already have a pending payout request. Please wait for it to be processed.')
      setIsRequesting(false)
      return
    }

    const { error } = await supabase
      .from('payout_requests')
      .insert({
        creator_id: session.user.id,
        amount: amount,
        phone: phoneNumber,
        status: 'pending'
      })

    if (error) {
      setPayoutMessage('Error requesting payout: ' + error.message)
    } else {
      setPayoutMessage(`Payout request of KES ${amount.toLocaleString()} submitted! Processing time: 1-3 business days.`)
      setPayoutAmount('')
      setPhoneNumber('')
      loadDashboard()
    }
    setIsRequesting(false)
  }

  const handleDelete = async (filmId: string, title: string) => {
    if (!confirm(`Delete "${title}" permanently? This action cannot be undone.`)) return
    const { error } = await supabase.from('content').delete().eq('id', filmId)
    if (error) {
      alert('Error deleting: ' + error.message)
    } else {
      loadDashboard()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-400'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'rejected': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const formatCurrency = (amount: number) => {
    return amount.toFixed(2)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────
  // COMPACT ONBOARDING FOR NON-CREATORS
  // ──────────────────────────────────────────────────────────────
  if (!isCreator) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-8">
        <div className="max-w-lg w-full bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 md:p-8">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-[#f5c518]/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-white">
              You’re not a creator yet.
            </h1>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed">
              To upload films, earn 70% of every sale, and build your audience,
              set up your creator profile.
            </p>

            <div className="mt-6 bg-[#0a0a0a] rounded-lg border border-white/5 p-4 text-left text-sm">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center text-[10px] font-bold">1</span>
                <div>
                  <p className="font-medium text-white">Go to your Profile</p>
                  <p className="text-xs text-gray-500">Account settings</p>
                </div>
              </div>
              <div className="flex items-start gap-3 mt-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center text-[10px] font-bold">2</span>
                <div>
                  <p className="font-medium text-white">Enable Creator mode</p>
                  <p className="text-xs text-gray-500">Toggle "Become a Creator"</p>
                </div>
              </div>
              <div className="flex items-start gap-3 mt-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center text-[10px] font-bold">3</span>
                <div>
                  <p className="font-medium text-white">Start uploading</p>
                  <p className="text-xs text-gray-500">Share your stories</p>
                </div>
              </div>
            </div>

            <Link
              href="/profile"
              className="mt-6 inline-flex items-center justify-center w-full px-5 py-2.5 bg-[#f5c518] text-black rounded-lg font-semibold hover:bg-[#e0b010] transition-all duration-200 text-sm"
            >
              Go to Profile
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>

            <p className="text-gray-500 text-xs mt-3">Setup takes less than 2 minutes.</p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 text-xs text-gray-500 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              reialproduction@gmail.com
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              habari@tucheki.com
            </span>
            <a
              href="https://wa.me/254704908255"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-500 hover:text-green-400 transition"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────
  // CREATOR DASHBOARD
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
              Welcome back, <span className="text-[#f5c518]">{displayName}</span>!
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">Here's an overview of your creator performance.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={loadDashboard}
              className="text-xs sm:text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            {isCreator && userId && (
              <>
                <Link
                  href={`/creator/${userId}/analytics`}
                  className="text-xs sm:text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
                >
                  Full Analytics
                </Link>
                <button
                  onClick={() => setIsOnboardingOpen(true)}
                  className="text-xs sm:text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
                >
                  How it works
                </button>
              </>
            )}
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a1a0a] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-[#f5c518]/20 mb-4 sm:mb-6 md:mb-8">
          <h3 className="text-sm sm:text-base md:text-lg font-bold mb-2 sm:mb-3 text-[#f5c518]">Revenue Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-[#0a0a0a] rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">Total Sales</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-400">{stats.totalSales}</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">You Earn (70%)</p>
              <p className="text-xl sm:text-2xl font-bold text-[#f5c518]">KES {formatCurrency(stats.yourEarnings)}</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg sm:rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">Platform Fee (30%)</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-400">KES {formatCurrency(stats.platformFees)}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8">
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 md:p-5 border border-white/5 hover:border-[#f5c518]/20 transition-all">
            <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wider font-medium">Films</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5">{stats.totalFilms}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 md:p-5 border border-white/5 hover:border-yellow-500/20 transition-all">
            <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wider font-medium">Pending</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-yellow-400">{stats.pendingApprovals}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 md:p-5 border border-white/5 hover:border-blue-500/20 transition-all">
            <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wider font-medium">Sales</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-blue-400">{stats.totalSales}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 md:p-5 border border-white/5 hover:border-green-500/20 transition-all">
            <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wider font-medium">Revenue</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-green-400">KES {formatCurrency(stats.grossRevenue)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#2a1a0a] rounded-xl p-3 sm:p-4 md:p-5 border border-[#f5c518]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#f5c518]/10 px-2 sm:px-3 py-0.5 rounded-bl-lg text-[8px] sm:text-[10px] text-[#f5c518] font-semibold">70%</div>
            <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wider font-medium">Earnings</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-[#f5c518]">KES {formatCurrency(stats.yourEarnings)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a2a1a] rounded-xl p-3 sm:p-4 md:p-5 border border-green-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-green-500/10 px-2 sm:px-3 py-0.5 rounded-bl-lg text-[8px] sm:text-[10px] text-green-400 font-semibold">Available</div>
            <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs uppercase tracking-wider font-medium">Balance</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold mt-0.5 text-green-400">KES {formatCurrency(stats.availableBalance)}</p>
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Performance Overview</h2>
              <p className="text-gray-500 text-[10px] sm:text-xs">Manage your content and track performance</p>
            </div>
            <Link
              href="/upload"
              className="bg-[#f5c518] text-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#e0b010] transition flex items-center gap-1.5 sm:gap-2"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload New
            </Link>
          </div>

          {content && content.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-[#0a0a0a] border-b border-white/5">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Title</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Category</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Price</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden md:table-cell">Views</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden lg:table-cell">Sales</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden xl:table-cell">Conv</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium hidden sm:table-cell">Revenue</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Status</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-gray-500 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {content.map((film: Content) => {
                    const conversion = film.views > 0 ? ((film.purchase_count / film.views) * 100).toFixed(1) : '0.0'
                    const revenue = film.price * film.purchase_count
                    const categoryPath = film.category ? film.category.toLowerCase() : 'film'
                    const slug = film.slug || film.id
                    const filmUrl = `/${categoryPath}/${slug}`
                    
                    return (
                      <tr key={film.id} className="hover:bg-white/5 transition">
                        <td className="px-3 sm:px-6 py-2 sm:py-4 font-medium text-xs sm:text-sm line-clamp-1 max-w-[80px] sm:max-w-[120px]">{film.title}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-400 text-[8px] sm:text-xs hidden sm:table-cell">
                          <span className="bg-[#0a0a0a] px-1.5 sm:px-2 py-0.5 rounded-full">{film.category || 'Film'}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-[#f5c518] font-semibold text-xs sm:text-sm">KES {film.price}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-400 text-xs hidden md:table-cell">{film.views}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-400 text-xs hidden lg:table-cell">{film.purchase_count}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-gray-400 text-xs hidden xl:table-cell">{conversion}%</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-green-400 text-xs hidden sm:table-cell">KES {formatCurrency(revenue)}</td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                          <span className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${getStatusColor(film.status)}`}>
                            {film.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            <button
                              onClick={() => window.open(filmUrl + '?preview=true', '_blank')}
                              className="text-gray-500 hover:text-[#f5c518] text-[8px] sm:text-xs transition"
                            >
                              Preview
                            </button>
                            <Link
                              href={`/upload/${film.id}`}
                              className="text-gray-500 hover:text-[#f5c518] text-[8px] sm:text-xs transition"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(film.id, film.title)}
                              className="text-gray-500 hover:text-red-400 text-[8px] sm:text-xs transition"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}${filmUrl}`
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(url).then(() => {
                                    alert('Link copied to clipboard!')
                                  }).catch(() => {
                                    prompt('Copy this link:', url)
                                  })
                                } else {
                                  prompt('Copy this link:', url)
                                }
                              }}
                              className="text-gray-500 hover:text-blue-400 text-[8px] sm:text-xs transition"
                            >
                              Share
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center">
              <div className="text-4xl sm:text-5xl mb-4 opacity-20">🎬</div>
              <p className="text-gray-400 text-sm sm:text-base">No films uploaded yet.</p>
              <Link href="/upload" className="text-[#f5c518] hover:underline text-xs sm:text-sm mt-2 inline-block">
                Create your first film →
              </Link>
            </div>
          )}
        </div>

        {/* Payout Section */}
        <div className="mt-6 sm:mt-8 md:mt-12 bg-[#1a1a1a] rounded-xl sm:rounded-2xl border border-white/5 p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-1">Request Payout</h2>
          <p className="text-gray-400 text-xs sm:text-sm mb-1">
            Minimum payout: KES 500 • Processing time: 1-3 business days
          </p>
          <p className="text-green-400 text-xs sm:text-sm mb-3 sm:mb-4">
            Available balance: <span className="font-bold">KES {formatCurrency(stats.availableBalance)}</span>
          </p>

          {payoutMessage && (
            <div className={`mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm ${
              payoutMessage.includes('submitted') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {payoutMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">Amount (KES)</label>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={`Max: ${formatCurrency(stats.availableBalance)}`}
                min="500"
                max={stats.availableBalance}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white text-sm"
              />
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                Max: KES {formatCurrency(stats.availableBalance)}
              </p>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1">M-Pesa Phone</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white text-sm"
                placeholder="0712345678"
              />
            </div>
          </div>

          <button
            onClick={handlePayoutRequest}
            disabled={isRequesting || stats.availableBalance < 500}
            className={`mt-3 sm:mt-4 px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              stats.availableBalance < 500 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-[#f5c518] text-black hover:bg-[#e0b010]'
            }`}
          >
            {isRequesting ? 'Submitting...' : stats.availableBalance < 500 ? 'Insufficient Balance' : 'Request Payout'}
          </button>

          {payoutHistory.length > 0 && (
            <div className="mt-4 sm:mt-6">
              <h3 className="text-xs sm:text-sm font-medium text-gray-400 mb-2 sm:mb-3">Payout History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="text-gray-500 border-b border-white/5">
                    <tr>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left">Amount</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left hidden sm:table-cell">Phone</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left">Status</th>
                      <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-left hidden xs:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutHistory.slice(0, 10).map((payout) => (
                      <tr key={payout.id} className="border-b border-white/5">
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-[#f5c518] font-bold text-xs sm:text-sm">KES {payout.amount}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs hidden sm:table-cell">{payout.phone}</td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2">
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${
                            payout.status === 'processed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {payout.status === 'processed' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-1.5 sm:py-2 text-gray-400 text-xs hidden xs:table-cell">
                          {new Date(payout.requested_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Contact + Logout */}
        <div className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 sm:mb-4">Contact Us</h3>
            <div className="space-y-3">
              <a
                href="mailto:reialproduction@gmail.com"
                className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg hover:bg-white/5 transition group"
              >
                <div className="w-9 h-9 rounded-full bg-[#f5c518]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm text-white group-hover:text-[#f5c518] transition truncate">
                    reialproduction@gmail.com
                  </p>
                </div>
              </a>
              
              <a
                href="https://wa.me/254704908255"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg hover:bg-green-500/10 transition group"
              >
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">WhatsApp</p>
                  <p className="text-sm text-white group-hover:text-green-400 transition">
                    Chat with us
                  </p>
                </div>
              </a>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-4 sm:p-5 flex flex-col justify-center">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Onboarding Guide Modal */}
      {userId && (
        <OnboardingGuide
          userId={userId}
          forceOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
        />
      )}
    </div>
  )
}
