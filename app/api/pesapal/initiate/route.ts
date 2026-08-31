import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getPesapalToken() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
  const environment = process.env.PESAPAL_ENVIRONMENT || 'production'

  const baseUrl = environment === 'sandbox'
    ? 'https://cybqa.pesapal.com/pesapalv3/api'
    : 'https://pay.pesapal.com/v3/api'

  if (!consumerKey || !consumerSecret ) {
    throw new Error('Pesapal credentials are missing')
  }

  const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
    }),
  })

  if (!authResponse.ok) {
    throw new Error(
      `Pesapal authentication failed: ${authResponse.status}`
    )
  }

  const authData = await authResponse.json()

  if (!authData.token) {
    throw new Error('Pesapal did not return an authentication token')
  }

  return { token: authData.token, baseUrl }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      purchaseId,
      description,
      email,
      firstName,
      lastName,
      phoneNumber,
    } = body

    if (!purchaseId) {
      return NextResponse.json(
        { error: 'Missing purchase ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Confirm that a real logged-in user is making this request.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in' },
        { status: 401 }
      )
    }

    const notificationId = process.env.PESAPAL_NOTIFICATION_ID?.trim()

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Pesapal notification ID is missing' },
        { status: 500 }
      )
    }

    // Load the purchase and verify that it belongs to this user.
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, buyer_id, amount_paid, status')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) {
      console.error('Purchase lookup failed:', purchaseError)
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      )
    }

    if (purchase.buyer_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not own this purchase' },
        { status: 403 }
      )
    }

    if (purchase.status === 'completed') {
      return NextResponse.json(
        { error: 'This purchase has already been paid for' },
        { status: 400 }
      )
    }

    const { token, baseUrl } = await getPesapalToken()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

    const paymentPayload = {
      // This must remain the purchase ID.
      id: purchase.id,
      currency: 'KES',
      amount: Number(purchase.amount_paid),
      description: description || 'Reial Network purchase',
      callback_url: `${appUrl}/api/pesapal/callback`,
      notification_id: notificationId,
      billing_address: {
        email_address: email || user.email || 'customer@example.com',
        phone_number: phoneNumber || '',
        first_name: firstName || 'Customer',
        last_name: lastName || 'User',
      },
    }

    const paymentResponse = await fetch(
      `${baseUrl}/Transactions/SubmitOrderRequest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(paymentPayload),
      }
    )

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('Pesapal payment failed:', errorText)

      return NextResponse.json(
        { error: 'Pesapal payment request failed' },
        { status: 500 }
      )
    }

    const paymentData = await paymentResponse.json()

    if (!paymentData.redirect_url) {
      console.error('Pesapal returned no redirect URL:', paymentData)

      return NextResponse.json(
        { error: 'No payment redirect URL received' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      redirect_url: paymentData.redirect_url,
    })
  } catch (error) {
    console.error('Pesapal initiation error:', error)

    return NextResponse.json(
      { error: 'Could not start payment' },
      { status: 500 }
    )
  }
}
