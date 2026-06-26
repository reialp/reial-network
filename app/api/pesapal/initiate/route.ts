import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { amount, purchaseId, description } = await req.json()

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET
    const environment = process.env.PESAPAL_ENVIRONMENT || 'sandbox'

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json({ error: 'Pesapal not configured' }, { status: 500 })
    }

    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3'

    // Step 1: Get OAuth token
    const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    })

    const authData = await authResponse.json()
    if (!authResponse.ok) {
      return NextResponse.json({ error: 'Failed to authenticate with Pesapal' }, { status: 500 })
    }

    const token = authData.token

    // Step 2: Initiate payment
    const paymentResponse = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: purchaseId,
        currency: 'KES',
        amount: amount,
        description: description || 'Reial Network purchase',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/pesapal/ipn`,
        notification_id: null,
        branch: 'Reial Network',
        source: 'web',
      }),
    })

    const paymentData = await paymentResponse.json()
    if (!paymentResponse.ok) {
      return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 })
    }

    const redirectUrl = paymentData.redirect_url

    return NextResponse.json({ redirect_url: redirectUrl })
  } catch (error) {
    console.error('Pesapal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
