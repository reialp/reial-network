'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CheckoutPage() {
  const router = useRouter()
  const supabase = createClient()

  const [film, setFilm] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOwnFilm, setIsOwnFilm] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        const currentPath = window.location.pathname
        router.push(`/auth/login?redirectTo=${currentPath}`)
        return
      }

      setUser(session.user)

      // Get film ID from URL
      const path = window.location.pathname
      const segments = path.split('/')
      const id = segments[segments.length - 1]

      if (!id || id === 'undefined' || id === 'null' || id === 'checkout' || id === '') {
        setError('Invalid film ID. Please go back and try again.')
        setLoading(false)
        return
      }

      // Load film
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .eq('status', 'approved')
        .single()

      if (error || !data) {
        console.error('Film load error:', error)
        setError('Film not found. It may not be approved yet.')
        setLoading(false)
        return
      }
      setFilm(data)

      // ✅ Check if user is the creator of this film
      setIsOwnFilm(data.creator_id === session.user.id)

      // ✅ Check if user is a creator or admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_creator, is_admin')
        .eq('id', session.user.id)
        .single()

      if (profile) {
        setIsCreator(profile.is_creator || false)
        setIsAdmin(profile.is_admin || false)
      }

      setLoading(false)
    }
    loadData()
  }, [supabase, router])

  const handlePurchase = async () => {
    if (!film) {
      setError('Film not loaded. Please refresh and try again.')
      return
    }

    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('You must be logged in to purchase.')
      setLoading(false)
      return
    }

    try {
      console.log('🎬 Starting purchase for:', film.title)

      const purchaseResponse = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: film.id,
          buyerId: session.user.id,
        }),
      })

      const purchaseResult = await purchaseResponse.json()
      console.log('📦 Purchase result:', purchaseResult)

      if (!purchaseResponse.ok) {
        setError(purchaseResult.error || 'Purchase creation failed.')
        setLoading(false)
        return
      }

      if (purchaseResult.alreadyPurchased) {
        router.push(`/watch/${purchaseResult.watchToken}`)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', session.user.id)
        .single()

      const fullName = profile?.full_name || 'Customer'
      const email = profile?.email || session.user.email || 'customer@example.com'

      const paymentResponse = await fetch('/api/pesapal/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: film.price,
          purchaseId: purchaseResult.purchaseId,
          description: film.title,
          email: email,
          firstName: fullName.split(' ')[0] || 'Customer',
          lastName: fullName.split(' ').slice(1).join(' ') || 'User',
          phoneNumber: '',
        }),
      })

      const paymentResult = await paymentResponse.json()

      if (!paymentResponse.ok) {
        setError(paymentResult.error || 'Payment initiation failed.')
        setLoading(false)
        return
      }

      if (paymentResult.redirect_url) {
        window.location.href = paymentResult.redirect_url
      } else {
        setError('No redirect URL received from payment provider.')
        setLoading(false)
      }

    } catch (err: any) {
      console.error('❌ Checkout error:', err)
      setError('Error: ' + err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={() => router.back()} className="text-[#f5c518] hover:underline">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!film) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  const total = Number(film.price)
  const platformFee = Number((total * 0.30).toFixed(2))
  const creatorEarnings = Number((total - platformFee).toFixed(2))

  // ✅ Only show revenue breakdown to creator of the film OR admin
  const showRevenueBreakdown = isOwnFilm || isAdmin

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Checkout</h1>

        <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-4 sm:p-6 space-y-3 sm:space-y-4">
          {/* Film Info */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm sm:text-base">Film</span>
            <span className="font-semibold text-sm sm:text-base">{film.title}</span>
          </div>
          
          {/* Price */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm sm:text-base">Price</span>
            <span className="text-sm sm:text-base">KES {film.price}</span>
          </div>

          {/* ✅ Revenue Breakdown - Only for Creator or Admin */}
          {showRevenueBreakdown && (
            <>
              <div className="border-t border-white/10 pt-3 sm:pt-4 space-y-2">
                <p className="text-xs text-gray-500 mb-2">Revenue Breakdown</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Platform/Admin Fee (30%)</span>
                  <span className="text-gray-400">KES {platformFee}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Creator Earnings (70%)</span>
                  <span className="text-[#f5c518] font-semibold">KES {creatorEarnings}</span>
                </div>
              </div>
            </>
          )}

          {/* Total */}
          <div className="border-t border-white/10 pt-3 sm:pt-4 flex justify-between items-center">
            <span className="font-bold text-sm sm:text-base">Total</span>
            <span className="text-[#f5c518] font-bold text-lg sm:text-xl">KES {total}</span>
          </div>

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full bg-[#f5c518] text-black py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base"
          >
            {loading ? 'Processing...' : 'Pay with Pesapal'}
          </button>

          {/* Footer Text */}
          <p className="text-[10px] sm:text-xs text-gray-500 text-center">
            You will be redirected to Pesapal for secure payment.
            No refunds after purchase.
          </p>
        </div>
      </div>
    </div>
  )
}
