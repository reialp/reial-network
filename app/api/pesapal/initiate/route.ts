import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getPesapalToken() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
  const environment = process.env.PESAPAL_ENVIRONMENT?.trim().toLowerCase() || 'production'

  const baseUrl =
    environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3/api'

  if (!consumerKey || !consumerSecret) {
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
    cache: 'no-store',
  })

  const authText = await authResponse.text()
  let authData: any = null

  try {
    authData = authText ? JSON.parse(authText) : null
  } catch {
    throw new Error(
      `Pesapal authentication returned invalid JSON: ${authResponse.status}`
    )
  }

  if (!authResponse.ok) {
    throw new Error(
      `Pesapal authentication failed: ${authResponse.status} ${authText}`
    )
  }

  if (!authData?.token) {
    throw new Error(
      `Pesapal did not return an authentication token: ${authText}`
    )
  }

  return {
    token: authData.token as string,
    baseUrl,
  }
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in' },
        { status: 401 }
      )
    }

    const notificationId = process.env.PESAPAL_NOTIFICATION_ID?.trim()

    if (!notificationId) {
      console.error('PESAPAL_NOTIFICATION_ID is missing')
      return NextResponse.json(
        { error: 'Pesapal notification ID is missing' },
        { status: 500 }
      )
    }

    const {
      data: purchase,
      error: purchaseError,
    } = await supabase
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

    const amount = Number(purchase.amount_paid)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid purchase amount' },
        { status: 400 }
      )
    }

    const { token, baseUrl } = await getPesapalToken()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin

    const paymentPayload = {
      id: purchase.id,
      currency: 'KES',
      amount,
      description: String(description || 'Reial Network purchase').slice(0, 100),
      callback_url: `${appUrl}/api/pesapal/callback`,
      notification_id: notificationId,
      billing_address: {
        email_address:
          String(email || user.email || 'customer@example.com').trim(),
        phone_number: String(phoneNumber || '').trim(),
        first_name: String(firstName || 'Customer').trim(),
        last_name: String(lastName || 'User').trim(),
        country_code: 'KE',
      },
    }

    console.log(
      'Sending order to Pesapal:',
      JSON.stringify(paymentPayload, null, 2)
    )

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
        cache: 'no-store',
      }
    )

    // Read the body once, then parse it safely. This also preserves useful
    // diagnostics when Pesapal returns an HTML or empty error response.
    const paymentText = await paymentResponse.text()
    let paymentData: any = null

    try {
      paymentData = paymentText ? JSON.parse(paymentText) : null
    } catch {
      console.error('Pesapal returned invalid JSON:', {
        status: paymentResponse.status,
        body: paymentText,
      })

      return NextResponse.json(
        { error: 'Pesapal returned an invalid response' },
        { status: 502 }
      )
    }

    console.log(
      'Pesapal order response:',
      JSON.stringify(paymentData, null, 2)
    )

    if (!paymentResponse.ok) {
      const providerMessage =
        paymentData?.message ||
        paymentData?.error?.message ||
        paymentData?.error_description ||
        'Pesapal payment request failed'

      console.error('Pesapal payment request failed:', {
        status: paymentResponse.status,
        response: paymentData,
      })

      return NextResponse.json(
        { error: providerMessage },
        { status: 502 }
      )
    }

    // Pesapal has returned both string and numeric representations in
    // integrations. Normalising prevents 200 from being rejected as non-200.
    if (
      paymentData?.status !== undefined &&
      String(paymentData.status) !== '200'
    ) {
      const providerMessage =
        paymentData?.message ||
        paymentData?.error?.message ||
        paymentData?.error_description ||
        'Pesapal order failed'

      console.error('Pesapal returned an unsuccessful order response:', {
        status: paymentData.status,
        response: paymentData,
      })

      return NextResponse.json(
        { error: providerMessage },
        { status: 502 }
      )
    }

    if (!paymentData?.redirect_url) {
      console.error('Pesapal returned no redirect URL:', paymentData)

      return NextResponse.json(
        { error: 'No payment redirect URL received from Pesapal' },
        { status: 502 }
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
