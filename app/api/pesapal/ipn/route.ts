import { NextResponse } from 'next/server'
import { finalizePurchase } from '@/lib/pesapal/finalizePurchase'

async function getPaymentDetails(req: Request) {
  const url = new URL(req.url)

  let purchaseId = url.searchParams.get('OrderMerchantReference')
  let trackingId = url.searchParams.get('OrderTrackingId')

  if (!purchaseId || !trackingId) {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}))

      purchaseId =
        purchaseId ||
        body.OrderMerchantReference ||
        body.orderMerchantReference ||
        body.purchaseId

      trackingId =
        trackingId ||
        body.OrderTrackingId ||
        body.orderTrackingId ||
        body.trackingId
    } else {
      const text = await req.text()
      const params = new URLSearchParams(text)

      purchaseId =
        purchaseId || params.get('OrderMerchantReference')

      trackingId =
        trackingId || params.get('OrderTrackingId')
    }
  }

  return { purchaseId, trackingId }
}

export async function GET(req: Request) {
  return processPaymentNotification(req)
}

export async function POST(req: Request) {
  return processPaymentNotification(req)
}

async function processPaymentNotification(req: Request) {
  try {
    const { purchaseId, trackingId } = await getPaymentDetails(req)

    if (!purchaseId || !trackingId) {
      console.error('Pesapal IPN is missing payment details')

      return NextResponse.json(
        { error: 'Missing payment details' },
        { status: 400 }
      )
    }

    const result = await finalizePurchase(
      purchaseId,
      trackingId
    )

    console.log('Pesapal IPN processed:', {
      purchaseId,
      trackingId,
      state: result.state,
    })

    return NextResponse.json({
      success: true,
      state: result.state,
    })
  } catch (error) {
    console.error('Pesapal IPN processing failed:', error)

    // Status 500 tells Pesapal to retry if there was a temporary failure.
    return NextResponse.json(
      { error: 'Temporary processing failure' },
      { status: 500 }
    )
  }
}
