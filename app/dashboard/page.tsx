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

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [userId, setUserId] = useState('')

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
          console.log('🔄 Purchase detected, refreshing dashboard...')
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
          console.log('🔄 Payout detected, refreshing dashboard...')
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
    const yourEarnings = Math.round(grossRevenue * 0.85)
    const platformFees = Math.round(grossRevenue * 0.15)

    const { data: purchasesData } = await supabase
      .from('purchases')
      .select('creator_earnings')
      .eq('status', 'completed')

    const totalEarningsFromPurchases = purchasesData?.reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0

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
      setPayoutMessage(`You can only request up to KES ${stats.availableBalance.toLocaleString()}. Your available balance is KES ${stats.availableBalance.toLocaleString()}.`)
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
      setPayoutMessage(`✅ Payout request of KES ${amount.toLocaleString()} submitted! Processing time: 1-3 business days.`)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-400'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      case 'rejected': return 'bg-red-500/20 text-red-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Welcome back, <span className="text-[#f5c518]">{displayName}</span>!
            </h1>
            <p className="text-gray-400 text-sm mt-1">Here's an overview of your creator performance.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              className="text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            {isCreator && (
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="text-sm text-gray-400 hover:text-[#f5c518] transition flex items-center gap-1"
              >
                <span>📖</span> How it works
              </button>
            )}
          </div>
        </div>

        {!isCreator && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-8">
            <p className="text-yellow-400 text-sm">
              You're not a creator yet. <Link href="/profile?intent=creator" className="text-[#f5c518] hover:underline">Become a creator</Link> to upload films and earn money.
            </p>
          </div>
        )}

        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a1a0a] rounded-2xl p-6 border border-[#f5c518]/20 mb-8">
          <h3 className="text-lg font-bold mb-3 text-[#f5c518]">Revenue Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Total Sales</p>
              <p className="text-2xl font-bold text-blue-400">{stats.totalSales}</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">You Earn (85%)</p>
              <p className="text-2xl font-bold text-[#f5c518]">KES {formatCurrency(stats.yourEarnings)}</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 border border-white/5">
              <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Platform Fee (15%)</p>
              <p className="text-2xl font-bold text-yellow-400">KES {formatCurrency(stats.platformFees)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/5 hover:border-[#f5c518]/20 transition-all">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Films Uploaded</p>
            <p className="text-2xl font-bold mt-1">{stats.totalFilms}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/5 hover:border-yellow-500/20 transition-all">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Pending Approvals</p>
            <p className="text-2xl font-bold mt-1 text-yellow-400">{stats.pendingApprovals}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/5 hover:border-blue-500/20 transition-all">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Total Sales</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{stats.totalSales}</p>
          </div>
          <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/5 hover:border-green-500/20 transition-all">
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Gross Revenue</p>
            <p className="text-2xl font-bold mt-1 text-green-400">KES {formatCurrency(stats.grossRevenue)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#2a1a0a] rounded-2xl p-5 border border-[#f5c518]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#f5c518]/10 px-3 py-1 rounded-bl-lg text-xs text-[#f5c518] font-semibold">85%</div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Total Earnings</p>
            <p className="text-2xl font-bold mt-1 text-[#f5c518]">KES {formatCurrency(stats.yourEarnings)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a2a1a] rounded-2xl p-5 border border-green-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-green-500/10 px-3 py-1 rounded-bl-lg text-xs text-green-400 font-semibold">Available</div>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-medium">Available Balance</p>
            <p className="text-2xl font-bold mt-1 text-green-400">KES {formatCurrency(stats.availableBalance)}</p>
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold">Performance Overview</h2>
              <p className="text-gray-500 text-xs">Manage your content and track performance</p>
            </div>
            <Link
              href="/upload"
              className="bg-[#f5c518] text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#e0b010] transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload New
            </Link>
          </div>

          {content && content.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0a0a] border-b border-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Title</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Category</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Price</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Views</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Sales</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Conversion</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Revenue</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Status</th>
                    <th className="px-6 py-3 text-left text-gray-500 text-xs uppercase tracking-wider font-medium">Actions</th>
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
                        <td className="px-6 py-4 font-medium">{film.title}</td>
                        <td className="px-6 py-4 text-gray-400 text-xs">
                          <span className="bg-[#0a0a0a] px-2 py-0.5 rounded-full">
                            {film.category || 'Film'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[#f5c518] font-semibold">KES {film.price}</td>
                        <td className="px-6 py-4 text-gray-400">{film.views}</td>
                        <td className="px-6 py-4 text-gray-400">{film.purchase_count}</td>
                        <td className="px-6 py-4 text-gray-400">{conversion}%</td>
                        <td className="px-6 py-4 text-green-400">KES {formatCurrency(revenue)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(film.status)}`}>
                            {film.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => window.open(filmUrl + '?preview=true', '_blank')}
                              className="text-gray-500 hover:text-[#f5c518] text-xs transition"
                            >
                              Preview
                            </button>
                            <Link
                              href={`/upload/${film.id}`}
                              className="text-gray-500 hover:text-[#f5c518] text-xs transition"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(film.id, film.title)}
                              className="text-gray-500 hover:text-red-400 text-xs transition"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}${filmUrl}`
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(url).then(() => {
                                    alert('🔗 Link copied to clipboard!')
                                  }).catch(() => {
                                    prompt('Copy this link:', url)
                                  })
                                } else {
                                  prompt('Copy this link:', url)
                                }
                              }}
                              className="text-gray-500 hover:text-blue-400 text-xs transition"
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
            <div className="p-12 text-center">
              <div className="text-5xl mb-4 opacity-20">🎬</div>
              <p className="text-gray-400">No films uploaded yet.</p>
              <Link href="/upload" className="text-[#f5c518] hover:underline text-sm mt-2 inline-block">
                Create your first film →
              </Link>
            </div>
          )}
        </div>

        <div className="mt-12 bg-[#1a1a1a] rounded-2xl border border-white/5 p-6">
          <h2 className="text-xl font-bold mb-2">Request Payout</h2>
          <p className="text-gray-400 text-sm mb-1">
            Minimum payout: KES 500 • Processing time: 1-3 business days
          </p>
          <p className="text-green-400 text-sm mb-4">
            Available balance: <span className="font-bold">KES {formatCurrency(stats.availableBalance)}</span>
          </p>

          {payoutMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              payoutMessage.includes('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {payoutMessage}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Amount (KES)</label>
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={`Max: ${formatCurrency(stats.availableBalance)}`}
                min="500"
                max={stats.availableBalance}
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Max: KES {formatCurrency(stats.availableBalance)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">M-Pesa Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                placeholder="e.g. 0712345678"
              />
            </div>
          </div>

          <button
            onClick={handlePayoutRequest}
            disabled={isRequesting || stats.availableBalance < 500}
            className={`mt-4 px-6 py-2 rounded-lg font-semibold transition ${
              stats.availableBalance < 500 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'bg-[#f5c518] text-black hover:bg-[#e0b010]'
            }`}
          >
            {isRequesting ? 'Submitting...' : stats.availableBalance < 500 ? 'Insufficient Balance' : 'Request Payout'}
          </button>

          {payoutHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Payout History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 border-b border-white/5">
                    <tr>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-left">Phone</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutHistory.map((payout) => (
                      <tr key={payout.id} className="border-b border-white/5">
                        <td className="px-4 py-2 text-[#f5c518] font-bold">KES {payout.amount}</td>
                        <td className="px-4 py-2">{payout.phone}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            payout.status === 'processed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {payout.status === 'processed' ? '✅ Paid' : '⏳ Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-400">
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
      </div>

      {isCreator && userId && (
        <OnboardingGuide
          userId={userId}
          forceOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
        />
      )}
    </div>
  )
}
