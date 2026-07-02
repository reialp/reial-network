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

  const [payoutAmount, setPayoutAmount] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [payoutHistory, setPayoutHistory] = useState<any[]>([])
  const [isRequesting, setIsRequesting] = useState(false)
  const [payoutMessage, setPayoutMessage] = useState('')

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [isCreator, setIsCreator] = useState(false)

  // ✅ FIX #4: Only check terms for creators, allow regular buyers to access dashboard
  useEffect(() => {
    const checkCreatorStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_creator, terms_accepted')
        .eq('id', session.user.id)
        .single()

      // ✅ If user is a creator but hasn't accepted terms, redirect to terms
      if (profile?.is_creator && !profile?.terms_accepted) {
        router.push('/terms')
        return
      }

      // ✅ If not a creator, they can still access the dashboard to view purchases
      setIsCreator(profile?.is_creator || false)
      setUserId(session.user.id)
      loadDashboard()
    }
    checkCreatorStatus()
  }, [])

  // ✅ Real-time subscriptions
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content', filter: `creator_id=eq.${userId}` },
        (payload) => {
          console.log('Content update:', payload)
          loadDashboard()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  const loadDashboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setDisplayName(profile.full_name || 'Creator')
      }

      // ✅ Only load creator content if user is a creator
      if (isCreator) {
        // Load creator's content
        const { data: contentData } = await supabase
          .from('content')
          .select('*')
          .eq('creator_id', session.user.id)
          .order('created_at', { ascending: false })

        if (contentData) {
          setContent(contentData)

          // Calculate stats
          const stats = {
            totalFilms: contentData.length,
            pendingApprovals: contentData.filter((c) => c.status === 'pending').length,
            totalSales: 0,
            grossRevenue: 0,
            yourEarnings: 0,
            availableBalance: 0,
            platformFees: 0,
          }

          // Load purchases for creator's content
          const { data: purchases } = await supabase
            .from('purchases')
            .select('*')
            .in('content_id', contentData.map((c) => c.id))

          if (purchases) {
            stats.totalSales = purchases.length
            const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount || 0), 0)
            stats.grossRevenue = totalRevenue
            stats.yourEarnings = Math.round(totalRevenue * 0.85)
            stats.platformFees = Math.round(totalRevenue * 0.15)
            stats.availableBalance = stats.yourEarnings
          }

          setStats(stats)
        }

        // Load payout history
        const { data: payouts } = await supabase
          .from('payouts')
          .select('*')
          .eq('creator_id', session.user.id)
          .order('created_at', { ascending: false })

        if (payouts) {
          setPayoutHistory(payouts)
        }

        // Check if should show onboarding
        const { data: onboarding } = await supabase
          .from('profiles')
          .select('onboarding_seen')
          .eq('id', session.user.id)
          .single()

        if (onboarding && !onboarding.onboarding_seen) {
          setIsOnboardingOpen(true)
        }
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading dashboard:', err)
      setLoading(false)
    }
  }

  const handleRequestPayout = async () => {
    if (!payoutAmount || !phoneNumber) {
      setPayoutMessage('Please enter amount and phone number.')
      return
    }

    setIsRequesting(true)
    setPayoutMessage('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { error } = await supabase
        .from('payouts')
        .insert({
          creator_id: session.user.id,
          amount: parseInt(payoutAmount),
          phone_number: phoneNumber,
          status: 'pending',
        })

      if (error) {
        setPayoutMessage('Error requesting payout: ' + error.message)
      } else {
        setPayoutMessage('✅ Payout requested! You will receive it within 1-3 business days.')
        setPayoutAmount('')
        setPhoneNumber('')
        loadDashboard()
      }
    } catch (err: any) {
      setPayoutMessage('Error: ' + err.message)
    }

    setIsRequesting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <OnboardingGuide isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />

      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Welcome, {displayName}!</h1>
          <p className="text-gray-400 mt-2">
            {isCreator ? 'Manage your content and earnings' : 'View your purchases and library'}
          </p>
        </div>

        {isCreator && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
                <p className="text-gray-400 text-sm">Total Films</p>
                <p className="text-3xl font-bold text-[#f5c518]">{stats.totalFilms}</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
                <p className="text-gray-400 text-sm">Pending Approvals</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingApprovals}</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
                <p className="text-gray-400 text-sm">Total Sales</p>
                <p className="text-3xl font-bold text-green-400">{stats.totalSales}</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-white/10">
                <p className="text-gray-400 text-sm">Your Earnings</p>
                <p className="text-3xl font-bold text-[#f5c518]">KES {stats.yourEarnings}</p>
              </div>
            </div>

            {/* Content Table */}
            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 overflow-hidden mb-8">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold">Your Content</h2>
                <Link
                  href="/upload"
                  className="bg-[#f5c518] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition"
                >
                  + Upload New
                </Link>
              </div>

              {content.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <p>No content uploaded yet.</p>
                  <Link href="/upload" className="text-[#f5c518] hover:underline">
                    Upload your first film
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0a0a0a]">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Title</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Price</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Sales</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.map((item) => (
                        <tr key={item.id} className="border-t border-white/5 hover:bg-[#0a0a0a] transition">
                          <td className="px-6 py-3 text-sm">{item.title}</td>
                          <td className="px-6 py-3 text-sm">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                item.status === 'approved'
                                  ? 'bg-green-500/20 text-green-400'
                                  : item.status === 'pending'
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm">KES {item.price}</td>
                          <td className="px-6 py-3 text-sm">{item.purchase_count || 0}</td>
                          <td className="px-6 py-3 text-sm">{item.views || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payout Section */}
            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-6">
              <h2 className="text-xl font-bold mb-4">Request Payout</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">Amount (KES)</label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    min="500"
                    className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                    placeholder="Minimum 500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300">M-Pesa Phone</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                    placeholder="0712345678"
                  />
                </div>
                {payoutMessage && (
                  <div
                    className={`px-4 py-3 rounded-lg text-sm ${
                      payoutMessage.includes('✅')
                        ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                        : 'bg-red-500/10 border border-red-500/50 text-red-400'
                    }`}
                  >
                    {payoutMessage}
                  </div>
                )}
                <button
                  onClick={handleRequestPayout}
                  disabled={isRequesting}
                  className="w-full bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
                >
                  {isRequesting ? 'Processing...' : 'Request Payout'}
                </button>
              </div>
            </div>
          </>
        )}

        {!isCreator && (
          <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-8 text-center">
            <p className="text-gray-400 mb-4">You're browsing as a regular user.</p>
            <p className="text-gray-400 mb-6">Want to become a creator and upload content?</p>
            <Link
              href="/profile?intent=creator"
              className="bg-[#f5c518] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition inline-block"
            >
              Become a Creator
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
