import { NextResponse } from 'next/server'
import { finalizePurchase } from '@/lib/pesapal/finalizePurchase'

export async function GET(req: Request) {
  const url = new URL(req.url)

  const purchaseId = url.searchParams.get('OrderMerchantReference')
  const trackingId = url.searchParams.get('OrderTrackingId')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin

  console.log('📩 Callback received:', { purchaseId, trackingId })

  if (!purchaseId || !trackingId) {
    console.error('❌ Missing purchaseId or trackingId')
    return NextResponse.redirect(
      new URL('/library?payment=failed&reason=missing_reference', appUrl)
    )
  }

  try {
    console.log('🔍 Calling finalizePurchase...')
    const result = await finalizePurchase(purchaseId, trackingId)
    
    // 🔴 CRITICAL: Log the full result
    console.log('📦 finalizePurchase result:', JSON.stringify(result, null, 2))

    let paymentStatus = 'failed'

    // Check for successful states
    if (result.state === 'completed' || result.state === 'already_completed') {
      paymentStatus = 'success'
    } else if (result.state === 'not_completed') {
      paymentStatus = 'pending'
    } else {
      // Any other state (error, amount_mismatch, etc.)
      console.error('❌ Unexpected result state:', result.state)
      paymentStatus = 'failed'
    }

    console.log(`🔄 Redirecting with payment=${paymentStatus}`)

    return NextResponse.redirect(
      new URL(
        `/library?payment=${paymentStatus}&ref=${encodeURIComponent(purchaseId)}`,
        appUrl
      )
    )
  } catch (error) {
    console.error('💥 Payment callback failed:', error)
    return NextResponse.redirect(
      new URL('/library?payment=failed&reason=finalization_error', appUrl)
    )
  }
}
