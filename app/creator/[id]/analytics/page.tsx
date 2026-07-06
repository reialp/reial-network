'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

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
  projects: {
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
  }[]
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
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    async function loadAnalytics() {
      if (!creatorId) {
        setError('No creator ID provided')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get creator profile
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

      // Check if current user is the creator or admin
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

      // Load all approved projects by this creator
      const { data: projects } = await supabase
        .from('content')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      const projectList = projects || []

      // Get purchases for these projects
      const projectIds = projectList.map(p => p.id)
      let purchases: any[] = []
      let allPurchases: any[] = []
      if (projectIds.length > 0) {
        const { data: purchasesData } = await supabase
          .from('purchases')
          .select('*, buyer:buyer_id(email)')
          .in('content_id', projectIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
        purchases = purchasesData || []
        allPurchases = purchasesData || []
      }

      // Calculate performance metrics
      const totalRevenue = projectList.reduce((sum, p) => sum + (p.price * (p.purchase_count || 0)), 0)
      const totalSales = projectList.reduce((sum, p) => sum + (p.purchase_count || 0), 0)
      const totalViews = projectList.reduce((sum, p) => sum + (p.views || 0), 0)
      const avgPrice = totalSales > 0 ? totalRevenue / totalSales : 0
      const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0

      // Calculate growth
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

      // Financials
      const yourEarnings = Math.round(totalRevenue * 0.85)
      const platformFees = Math.round(totalRevenue * 0.15)

      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('creator_id', creatorId)

      const pendingPayouts = payouts?.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0) || 0
      const processedPayouts = payouts?.filter(p => p.status === 'processed').reduce((sum, p) => sum + p.amount, 0) || 0
      const availableBalance = yourEarnings - pendingPayouts - processedPayouts

      // Projects with stats
      const mappedProjects = projectList.map(p => ({
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
      }))

      // Recent transactions
      const recentTransactions = purchases.slice(0, 10).map(p => ({
        id: p.id,
        project_title: p.content?.title || 'Unknown',
        amount: p.amount_paid || p.amount || 0,
        buyer_name: p.buyer?.email || 'Anonymous',
        created_at: p.created_at,
        status: p.status || 'completed',
      }))

      // Chart data
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

      // Generate insights
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

      setLoading(false)
    }

    loadAnalytics()
  }, [supabase, router, creatorId])

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString()
  }

  // Get selected project details
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

  // If a project is selected, show project-specific stats
  if (selectedProject) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          
          {/* Back Button */}
          <button
            onClick={() => setSelectedProjectId(null)}
            className="text-gray-400 hover:text-[#f5c518] transition text-sm flex items-center gap-2 mb-6"
          >
            ← Back to Overview
          </button>

          {/* Project Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-lg bg-[#2a2a2a] overflow-hidden flex-shrink-0">
              {selectedProject.thumbnail_url ? (
                <Image
                  src={selectedProject.thumbnail_url}
                  alt={selectedProject.title}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">🎬</div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{selectedProject.title}</h1>
              <p className="text-gray-400 text-sm">Project Analytics</p>
            </div>
            <Link
              href={`/${selectedProject.category?.toLowerCase() || 'film'}/${selectedProject.slug || selectedProject.id}`}
              className="ml-auto text-sm bg-[#f5c518] text-black px-4 py-1.5 rounded-lg font-semibold hover:bg-[#e0b010] transition"
            >
              View Project
            </Link>
          </div>

          {/* Project Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Revenue</p>
              <p className="text-xl font-bold text-green-400">KES {formatCurrency(selectedProject.revenue)}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Sales</p>
              <p className="text-xl font-bold text-blue-400">{selectedProject.purchase_count}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Views</p>
              <p className="text-xl font-bold text-purple-400">{selectedProject.views}</p>
            </div>
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Conversion</p>
              <p className="text-xl font-bold text-orange-400">{selectedProject.conversionRate.toFixed(1)}%</p>
            </div>
          </div>

          {/* Edit Project Link */}
          <Link
            href={`/upload/${selectedProject.id}`}
            className="inline-block bg-[#1a1a1a] border border-white/10 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition"
          >
            Edit Project
          </Link>
        </div>
      </div>
    )
  }

  // Overall View - Full Analytics Dashboard
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
            <p className="text-gray-400 text-sm">{profile.full_name}</p>
          </div>
          <Link
            href={`/profile`}
            className="text-sm text-gray-400 hover:text-[#f5c518] transition"
          >
            ← Back to Profile
          </Link>
        </div>

        {/* Insights Banner */}
        <div className="bg-gradient-to-r from-[#f5c518]/10 to-[#f5c518]/5 border border-[#f5c518]/20 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-[#f5c518]">Insights</p>
              <p className="text-sm text-gray-300">{insights.growthMessage}</p>
              <p className="text-xs text-gray-400 mt-1">{insights.recommendation}</p>
            </div>
            <span className="text-xs bg-[#f5c518]/20 text-[#f5c518] px-3 py-1 rounded-full">
              Top: {insights.bestPerforming}
            </span>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 hover:border-[#f5c518]/20 transition">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Revenue</p>
            <p className="text-xl font-bold text-green-400">KES {formatCurrency(overall.totalRevenue)}</p>
            <span className={`text-xs ${overall.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {overall.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(Math.round(overall.revenueGrowth))}%
            </span>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 hover:border-blue-500/20 transition">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Sales</p>
            <p className="text-xl font-bold text-blue-400">{overall.totalSales}</p>
            <span className={`text-xs ${overall.salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {overall.salesGrowth >= 0 ? '↑' : '↓'} {Math.abs(Math.round(overall.salesGrowth))}%
            </span>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 hover:border-purple-500/20 transition">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Views</p>
            <p className="text-xl font-bold text-purple-400">{overall.totalViews}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5 hover:border-orange-500/20 transition">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Conversion</p>
            <p className="text-xl font-bold text-orange-400">{overall.conversionRate.toFixed(1)}%</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a2a1a] rounded-xl p-4 border border-green-500/20">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Balance</p>
            <p className="text-xl font-bold text-green-400">KES {formatCurrency(financials.availableBalance)}</p>
            <span className="text-xs text-gray-500">Pending: KES {formatCurrency(financials.pendingPayouts)}</span>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance Over Time</h3>
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          <div className="h-[180px] sm:h-[220px] relative">
            <div className="absolute inset-0 flex items-end">
              {chartData.labels.map((label, i) => {
                const maxRevenue = Math.max(...chartData.revenue, 1)
                const height = (chartData.revenue[i] / maxRevenue) * 100
                const maxSales = Math.max(...chartData.sales, 1)
                const salesHeight = (chartData.sales[i] / maxSales) * 100
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex justify-center gap-0.5">
                      <div 
                        className="w-1.5 sm:w-2.5 bg-[#f5c518] rounded-t"
                        style={{ height: `${Math.max(height * 0.7, 2)}px` }}
                      />
                      <div 
                        className="w-1.5 sm:w-2.5 bg-blue-400 rounded-t"
                        style={{ height: `${Math.max(salesHeight * 0.5, 2)}px` }}
                      />
                    </div>
                    <span className="text-[6px] sm:text-[8px] text-gray-600 rotate-45 sm:rotate-0 origin-left sm:origin-center">
                      {label.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#f5c518] rounded" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-blue-400 rounded" />
              Sales
            </span>
          </div>
        </div>

        {/* Projects List - Click to view project analytics */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Your Projects</h3>
            <p className="text-xs text-gray-500 mt-1">Click a project to view detailed analytics</p>
          </div>
          <div className="divide-y divide-white/5">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#2a2a2a] overflow-hidden flex-shrink-0">
                    {project.thumbnail_url ? (
                      <Image
                        src={project.thumbnail_url}
                        alt={project.title}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-gray-500">🎬</div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-[#f5c518] transition">{project.title}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>KES {project.price}</span>
                      <span>•</span>
                      <span>{project.views} views</span>
                      <span>•</span>
                      <span>{project.purchase_count} sales</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-green-400">KES {formatCurrency(project.revenue)}</span>
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-[#f5c518] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Transactions</h3>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0a0a]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-gray-500 text-xs uppercase tracking-wider">Project</th>
                    <th className="px-4 py-2.5 text-left text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Buyer</th>
                    <th className="px-4 py-2.5 text-left text-gray-500 text-xs uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-2.5 text-left text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="px-4 py-2.5 text-left text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition">
                      <td className="px-4 py-2.5 text-sm truncate max-w-[120px]">{tx.project_title}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-sm hidden sm:table-cell truncate max-w-[100px]">{tx.buyer_name}</td>
                      <td className="px-4 py-2.5 text-[#f5c518] font-semibold">KES {formatCurrency(tx.amount)}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-sm hidden md:table-cell">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
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
