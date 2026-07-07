'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

interface Project {
  id: string
  title: string
  thumbnail_url: string
  price: number
  views: number
  purchase_count: number
  revenue: number
  conversionRate: number
  status: string
  created_at: string
  category: string
  slug: string
  description: string
  trailer_url: string
  video_url: string
}

interface AnalyticsData {
  profile: {
    id: string
    full_name: string
    avatar_url: string
    is_creator: boolean
    bio: string
  }
  overall: {
    totalRevenue: number
    totalSales: number
    totalViews: number
    avgPrice: number
    conversionRate: number
    revenueGrowth: number
    salesGrowth: number
  }
  financials: {
    yourEarnings: number
    platformFees: number
    availableBalance: number
    pendingPayouts: number
    lifetimeEarnings: number
  }
  projects: Project[]
  recentTransactions: {
    id: string
    project_title: string
    amount: number
    buyer_name: string
    created_at: string
    status: string
  }[]
  chartData: {
    labels: string[]
    revenue: number[]
    sales: number[]
    views: number[]
  }
  insights: {
    bestPerforming: string
    topCategory: string
    growthMessage: string
    recommendation: string
  }
}

export default function CreatorAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const creatorId = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadAnalytics = async (showRefresh = false) => {
    if (!creatorId) {
      setError('No creator ID provided')
      setLoading(false)
      return
    }

    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_creator, bio')
        .eq('id', creatorId)
        .single()

      if (profileError || !profile) {
        setError('Creator not found')
        setLoading(false)
        return
      }

      if (session.user.id !== creatorId) {
        const { data: adminCheck } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
        
        if (!adminCheck?.is_admin) {
          setError('You do not have permission to view this analytics')
          setLoading(false)
          return
        }
      }

      const { data: projects } = await supabase
        .from('content')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      const projectList = projects || []

      const projectIds = projectList.map(p => p.id)
      let purchases: any[] = []
      let allPurchases: any[] = []
      if (projectIds.length > 0) {
        const { data: purchasesData } = await supabase
          .from('purchases')
          .select('*')
          .in('content_id', projectIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
        purchases = purchasesData || []
        allPurchases = purchasesData || []
      }

      const totalRevenue = projectList.reduce((sum, p) => sum + (p.price * (p.purchase_count || 0)), 0)
      const totalSales = projectList.reduce((sum, p) => sum + (p.purchase_count || 0), 0)
      const totalViews = projectList.reduce((sum, p) => sum + (p.views || 0), 0)
      const avgPrice = totalSales > 0 ? totalRevenue / totalSales : 0
      const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0

      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const sixtyDaysAgo = new Date(now)
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const recentPurchases = allPurchases.filter(p => new Date(p.created_at) >= thirtyDaysAgo)
      const previousPurchases = allPurchases.filter(p => 
        new Date(p.created_at) >= sixtyDaysAgo && new Date(p.created_at) < thirtyDaysAgo
      )

      const recentRevenue = recentPurchases.reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0)
      const previousRevenue = previousPurchases.reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0)
      const revenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0

      const recentSales = recentPurchases.length
      const previousSales = previousPurchases.length
      const salesGrowth = previousSales > 0 ? ((recentSales - previousSales) / previousSales) * 100 : 0

      const yourEarnings = Math.round(totalRevenue * 0.85)
      const platformFees = Math.round(totalRevenue * 0.15)

      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('creator_id', creatorId)

      const pendingPayouts = payouts?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0) || 0
      const processedPayouts = payouts?.filter(p => p.status === 'processed').reduce((sum, p) => sum + p.amount, 0) || 0
      const availableBalance = yourEarnings - pendingPayouts - processedPayouts

      const mappedProjects: Project[] = projectList.map(p => ({
        id: p.id,
        title: p.title,
        thumbnail_url: p.thumbnail_url,
        price: p.price,
        views: p.views || 0,
        purchase_count: p.purchase_count || 0,
        revenue: p.price * (p.purchase_count || 0),
        conversionRate: p.views > 0 ? ((p.purchase_count || 0) / p.views) * 100 : 0,
        status: p.status,
        created_at: p.created_at,
        category: p.category || 'Film',
        slug: p.slug || p.id,
        description: p.description || '',
        trailer_url: p.trailer_url || '',
        video_url: p.video_url || '',
      }))

      const recentTransactions = purchases.slice(0, 10).map(p => ({
        id: p.id,
        project_title: p.content?.title || 'Unknown',
        amount: p.amount_paid || p.amount || 0,
        buyer_name: 'User',
        created_at: p.created_at,
        status: p.status || 'completed',
      }))

      const labels: string[] = []
      const revenueData: number[] = []
      const salesData: number[] = []
      const viewsData: number[] = []

      for (let i = 29; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
        
        const daySales = allPurchases.filter(p => {
          const pDate = new Date(p.created_at)
          return pDate.toDateString() === date.toDateString()
        })
        
        const dayViews = projectList.reduce((sum, p) => {
          const pDate = new Date(p.created_at)
          return sum + (pDate.toDateString() === date.toDateString() ? (p.views || 0) : 0)
        }, 0)
        
        revenueData.push(daySales.reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0))
        salesData.push(daySales.length)
        viewsData.push(dayViews)
      }

      const bestProject = mappedProjects.length > 0 ? 
        mappedProjects.reduce((a, b) => a.revenue > b.revenue ? a : b) : null
      
      const categories = projectList.map(p => p.category).filter(Boolean)
      const topCategory = categories.length > 0 ? 
        categories.sort((a, b) => 
          categories.filter(c => c === a).length - categories.filter(c => c === b).length
        ).pop() : 'N/A'

      const growthMessage = revenueGrowth > 0 
        ? `Revenue is up ${Math.round(revenueGrowth)}% compared to last month` 
        : revenueGrowth < 0 
          ? `Revenue is down ${Math.round(Math.abs(revenueGrowth))}% compared to last month` 
          : 'Revenue is steady compared to last month'

      const recommendation = totalSales > 0 && bestProject
        ? `Your best performing project "${bestProject.title}" has generated KES ${bestProject.revenue.toLocaleString()}. Consider creating similar content.`
        : 'Start uploading content to begin earning'

      setData({
        profile,
        overall: {
          totalRevenue,
          totalSales,
          totalViews,
          avgPrice: avgPrice || 0,
          conversionRate,
          revenueGrowth,
          salesGrowth,
        },
        financials: {
          yourEarnings,
          platformFees,
          availableBalance,
          pendingPayouts,
          lifetimeEarnings: yourEarnings,
        },
        projects: mappedProjects,
        recentTransactions,
        chartData: {
          labels,
          revenue: revenueData,
          sales: salesData,
          views: viewsData,
        },
        insights: {
          bestPerforming: bestProject?.title || 'N/A',
          topCategory: topCategory || 'N/A',
          growthMessage,
          recommendation,
        },
      })

      setLastUpdated(new Date())
    } catch (err) {
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [supabase, router, creatorId])

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString()
  }

  const selectedProject = data?.projects.find(p => p.id === selectedProjectId)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error || 'No data available'}</p>
          <button onClick={() => router.back()} className="text-[#f5c518] hover:underline">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const { profile, overall, financials, projects, recentTransactions, chartData, insights } = data

  // 🔍 PROJECT DETAIL VIEW - Mobile Optimized
  if (selectedProject) {
    const projectPurchases = recentTransactions.filter(t => t.project_title === selectedProject.title)
    const totalRevenue = selectedProject.revenue
    const totalSales = selectedProject.purchase_count
    const totalViews = selectedProject.views
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          
          <button
            onClick={() => setSelectedProjectId(null)}
            className="text-gray-400 hover:text-[#f5c518] transition text-sm flex items-center gap-2 mb-4 sm:mb-6 group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Overview
          </button>

          {/* Project Header - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#2a2a2a] overflow-hidden flex-shrink-0 border border-white/10">
              {selectedProject.thumbnail_url ? (
                <Image
                  src={selectedProject.thumbnail_url}
                  alt={selectedProject.title}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl text-gray-500">🎬</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{selectedProject.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs sm:text-sm text-gray-400">{selectedProject.category}</span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="text-xs sm:text-sm text-gray-400">KES {selectedProject.price}</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{selectedProject.description || 'No description'}</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <Link
                href={`/${selectedProject.category.toLowerCase()}/${selectedProject.slug}`}
                className="bg-[#f5c518] text-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition text-xs sm:text-sm flex-1 sm:flex-none text-center"
              >
                View Project
              </Link>
              <Link
                href={`/upload/${selectedProject.id}`}
                className="bg-[#1a1a1a] border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-white/5 transition flex-1 sm:flex-none text-center"
              >
                Edit
              </Link>
            </div>
          </div>

          {/* Stats Grid - Mobile Optimized */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
            <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">Revenue</p>
              <p className="text-lg sm:text-2xl font-bold text-green-400">KES {formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">Sales</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-400">{totalSales}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">Views</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-400">{totalViews}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wider font-medium">Conversion</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-400">{selectedProject.conversionRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Project Details & Revenue Breakdown - Mobile Optimized */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-white/5">
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Project Details</h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs sm:text-sm text-gray-400">Created</span>
                  <span className="text-xs sm:text-sm">{new Date(selectedProject.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs sm:text-sm text-gray-400">Category</span>
                  <span className="text-xs sm:text-sm">{selectedProject.category}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs sm:text-sm text-gray-400">Price</span>
                  <span className="text-xs sm:text-sm font-semibold">KES {selectedProject.price}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-400">Status</span>
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">{selectedProject.status}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-white/5">
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue Breakdown</h3>
              <div className="space-y-2 sm:space-y-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs sm:text-sm text-gray-400">Gross Revenue</span>
                  <span className="text-xs sm:text-sm font-bold">KES {formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs sm:text-sm text-gray-400">Your Earnings (85%)</span>
                  <span className="text-xs sm:text-sm font-bold text-[#f5c518]">KES {formatCurrency(Math.round(totalRevenue * 0.85))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-400">Platform Fee (15%)</span>
                  <span className="text-xs sm:text-sm font-bold text-yellow-400">KES {formatCurrency(Math.round(totalRevenue * 0.15))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase History - Mobile Optimized */}
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/5">
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Purchase History</h3>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{projectPurchases.length} purchases</p>
            </div>
            {projectPurchases.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-500 text-xs sm:text-sm">No purchases yet for this project</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-[#0a0a0a]">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">Buyer</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">Amount</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {projectPurchases.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition">
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{tx.buyer_name}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-[#f5c518] font-semibold text-xs sm:text-sm">KES {formatCurrency(tx.amount)}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-400 text-xs hidden sm:table-cell">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                          <span className="px-1.5 sm:px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] sm:text-xs">{tx.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 📊 OVERALL VIEW - Mobile Optimized
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#1a1a1a] border-2 border-white/10 overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-base sm:text-xl text-gray-500">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold">Analytics</h1>
              <p className="text-gray-400 text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">{profile.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {lastUpdated && (
              <span className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
              className="text-xs sm:text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
            >
              <svg className={`w-3 h-3 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link
              href={`/profile`}
              className="text-xs sm:text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Back</span>
            </Link>
          </div>
        </div>

        {/* Insights Banner - Mobile Optimized */}
        <div className="bg-gradient-to-r from-[#f5c518]/10 to-[#f5c518]/5 border border-[#f5c518]/20 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-sm font-medium text-[#f5c518]">Key Insight</p>
              <p className="text-xs sm:text-sm text-gray-300 truncate">{insights.growthMessage}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 truncate">{insights.recommendation}</p>
            </div>
            <span className="text-[10px] sm:text-xs bg-[#f5c518]/20 text-[#f5c518] px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap flex-shrink-0">
              Top: {insights.bestPerforming}
            </span>
          </div>
        </div>

        {/* Stats Grid - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-[#f5c518]/20 transition">
            <p className="text-gray-400 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Revenue</p>
            <p className="text-base sm:text-xl font-bold text-green-400">KES {formatCurrency(overall.totalRevenue)}</p>
            <span className={`text-[8px] sm:text-xs ${overall.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {overall.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(Math.round(overall.revenueGrowth))}%
            </span>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-blue-500/20 transition">
            <p className="text-gray-400 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Sales</p>
            <p className="text-base sm:text-xl font-bold text-blue-400">{overall.totalSales}</p>
            <span className={`text-[8px] sm:text-xs ${overall.salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {overall.salesGrowth >= 0 ? '↑' : '↓'} {Math.abs(Math.round(overall.salesGrowth))}%
            </span>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-purple-500/20 transition">
            <p className="text-gray-400 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Views</p>
            <p className="text-base sm:text-xl font-bold text-purple-400">{overall.totalViews}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-3 sm:p-4 border border-white/5 hover:border-orange-500/20 transition">
            <p className="text-gray-400 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Conversion</p>
            <p className="text-base sm:text-xl font-bold text-orange-400">{overall.conversionRate.toFixed(1)}%</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a2a1a] rounded-xl p-3 sm:p-4 border border-green-500/20 col-span-2 sm:col-span-1">
            <p className="text-gray-400 text-[8px] sm:text-xs uppercase tracking-wider font-medium">Balance</p>
            <p className="text-base sm:text-xl font-bold text-green-400">KES {formatCurrency(financials.availableBalance)}</p>
            <span className="text-[8px] sm:text-xs text-gray-500">Pending: KES {formatCurrency(financials.pendingPayouts)}</span>
          </div>
        </div>

        {/* Financial Breakdown - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-white/5">
            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue Split</h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-400">Your Earnings (85%)</span>
                <span className="text-xs sm:text-sm text-[#f5c518] font-bold">KES {formatCurrency(financials.yourEarnings)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-400">Platform Fee (15%)</span>
                <span className="text-xs sm:text-sm text-yellow-400 font-bold">KES {formatCurrency(financials.platformFees)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 sm:pt-3 border-t border-white/5">
                <span className="text-xs sm:text-sm text-gray-400">Lifetime Earnings</span>
                <span className="text-xs sm:text-sm text-green-400 font-bold">KES {formatCurrency(financials.lifetimeEarnings)}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-white/5">
            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <p className="text-gray-500 text-[10px] sm:text-xs">Projects</p>
                <p className="text-base sm:text-lg font-bold">{projects.length}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] sm:text-xs">Avg Price</p>
                <p className="text-base sm:text-lg font-bold">KES {formatCurrency(Math.round(overall.avgPrice))}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] sm:text-xs">Top Category</p>
                <p className="text-sm sm:text-base font-bold text-[#f5c518] truncate">{insights.topCategory}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px] sm:text-xs">Best Project</p>
                <p className="text-xs sm:text-sm font-bold text-[#f5c518] truncate">{insights.bestPerforming}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart - Mobile Optimized */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-white/5 mb-4 sm:mb-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance</h3>
            <span className="text-[10px] sm:text-xs text-gray-500">Last 30 days</span>
          </div>
          <div className="h-[150px] sm:h-[220px] relative">
            <div className="absolute inset-0 flex items-end">
              {chartData.labels.map((label, i) => {
                const maxRevenue = Math.max(...chartData.revenue, 1)
                const height = (chartData.revenue[i] / maxRevenue) * 100
                const maxSales = Math.max(...chartData.sales, 1)
                const salesHeight = (chartData.sales[i] / maxSales) * 100
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1">
                    <div className="w-full flex justify-center gap-0.5">
                      <div 
                        className="w-1 sm:w-2.5 bg-[#f5c518] rounded-t"
                        style={{ height: `${Math.max(height * 0.7, 2)}px` }}
                      />
                      <div 
                        className="w-1 sm:w-2.5 bg-blue-400 rounded-t"
                        style={{ height: `${Math.max(salesHeight * 0.5, 2)}px` }}
                      />
                    </div>
                    <span className="text-[5px] sm:text-[8px] text-gray-600 rotate-45 sm:rotate-0 origin-left sm:origin-center">
                      {label.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex justify-center gap-3 sm:gap-6 mt-2 text-[10px] sm:text-xs text-gray-500">
            <span className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#f5c518] rounded" />
              Revenue
            </span>
            <span className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-blue-400 rounded" />
              Sales
            </span>
          </div>
        </div>

        {/* Project Grid - Mobile Optimized */}
        <div className="mb-4 sm:mb-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <div>
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Projects</h3>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Click a project for details</p>
            </div>
            <span className="text-[10px] sm:text-xs text-gray-500">{projects.length} projects</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className="group bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/5 hover:border-[#f5c518]/30 transition hover:scale-[1.02] text-left"
              >
                <div className="aspect-[16/9] bg-[#2a2a2a] relative overflow-hidden">
                  {project.thumbnail_url ? (
                    <Image
                      src={project.thumbnail_url}
                      alt={project.title}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-2xl sm:text-4xl text-gray-600">🎬</div>
                  )}
                  <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-black/60 text-[8px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full text-white">
                    KES {project.price}
                  </div>
                </div>
                <div className="p-2 sm:p-4">
                  <h4 className="text-xs sm:text-sm font-semibold group-hover:text-[#f5c518] transition truncate">
                    {project.title}
                  </h4>
                  <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5">{project.category}</p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2 text-[8px] sm:text-xs text-gray-500">
                    <span>👁 {project.views}</span>
                    <span>📦 {project.purchase_count}</span>
                    <span className="text-green-400 font-semibold text-[8px] sm:text-xs">KES {formatCurrency(project.revenue)}</span>
                  </div>
                  <div className="mt-1 sm:mt-2 text-[8px] sm:text-[10px] text-gray-600 group-hover:text-[#f5c518] transition flex items-center gap-0.5 sm:gap-1">
                    Click for details
                    <svg className="w-2 h-2 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Transactions - Mobile Optimized */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/5">
            <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Transactions</h3>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 text-xs sm:text-sm">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">Project</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider hidden sm:table-cell">Buyer</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">Amount</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-2.5 text-left text-gray-500 text-[10px] sm:text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition">
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[120px]">{tx.project_title}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-400 text-xs hidden sm:table-cell truncate max-w-[80px]">{tx.buyer_name}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-[#f5c518] font-semibold text-xs sm:text-sm">KES {formatCurrency(tx.amount)}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5 text-gray-400 text-xs hidden md:table-cell">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-2.5">
                        <span className="px-1.5 sm:px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] sm:text-xs">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
