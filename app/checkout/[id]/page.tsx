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

  useEffect(() => {
    async function loadData() {
      // ✅ Step 1: Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // ✅ NOT logged in → redirect to login with return URL
        const currentPath = window.location.pathname
        console.log('🔒 Not logged in, redirecting to login with return URL:', currentPath)
        router.push(`/auth/login?redirectTo=${currentPath}`)
        return
      }

      setUser(session.user)

      // ✅ Step 2: Get film ID from URL
      const path = window.location.pathname
      const segments = path.split('/')
      const id = segments[segments.length - 1]

      console.log('🔍 Checkout - ID from URL:', id)

      if (!id || id === 'undefined' || id === 'null' || id === 'checkout' || id === '') {
        setError('Invalid film ID. Please go back and try again.')
        setLoading(false)
        return
      }

      // ✅ Step 3: Load film
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

      // Step 1: Create purchase record (status = pending)
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

      // Step 2: Get user profile for billing info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', session.user.id)
        .single()

      const fullName = profile?.full_name || 'Customer'
      const email = profile?.email || session.user.email || 'customer@example.com'

      // Step 3: Initiate PesaPal payment
      console.log('💳 Initiating PesaPal payment for:', purchaseResult.purchaseId)

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

      console.log('📡 Payment response status:', paymentResponse.status)

      const paymentResult = await paymentResponse.json()
      console.log('💰 Payment result:', paymentResult)

      if (!paymentResponse.ok) {
        setError(paymentResult.error || 'Payment initiation failed.')
        setLoading(false)
        return
      }

      // Redirect to PesaPal payment page
      if (paymentResult.redirect_url) {
        console.log('🔀 Redirecting to PesaPal:', paymentResult.redirect_url)
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
        <div className="text-gray-400">Loading...</div>
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

  const total = film.price
  const platformFee = Math.round(total * 0.15)
  const creatorEarnings = Math.round(total * 0.85)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>

        <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Film</span>
            <span className="font-semibold">{film.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Price</span>
            <span>KES {film.price}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Platform Fee (15%)</span>
            <span className="text-gray-400">KES {platformFee}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Creator Earnings (85%)</span>
            <span className="text-[#f5c518]">KES {creatorEarnings}</span>
          </div>
          <div className="border-t border-white/10 pt-4 flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-[#f5c518]">KES {total}</span>
          </div>

          <button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Pay with Pesapal'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            You will be redirected to Pesapal for secure payment.
            No refunds after purchase.
          </p>
        </div>
      </div>
    </div>
  )
}
