import { NextResponse } from 'next/server'
import { finalizePurchase } from '@/lib/pesapal/finalizePurchase'

export async function GET(req: Request) {
  const url = new URL(req.url)

  const purchaseId = url.searchParams.get('OrderMerchantReference')
  const trackingId = url.searchParams.get('OrderTrackingId')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin

  if (!purchaseId || !trackingId) {
    return NextResponse.redirect(
      new URL(
        '/library?payment=failed&reason=missing_reference',
        appUrl
      )
    )
  }

  try {
    const result = await finalizePurchase(
      purchaseId,
      trackingId
    )

    let paymentStatus = 'failed'

    if (
      result.state === 'completed' ||
      result.state === 'already_completed'
    ) {
      paymentStatus = 'success'
    }

    if (result.state === 'not_completed') {
      paymentStatus = 'pending'
    }

    return NextResponse.redirect(
      new URL(
        `/library?payment=${paymentStatus}&ref=${encodeURIComponent(purchaseId)}`,
        appUrl
      )
    )
  } catch (error) {
    console.error('Payment callback failed:', error)

    return NextResponse.redirect(
      new URL(
        '/library?payment=failed&reason=finalization_error',
        appUrl
      )
    )
  }
}
