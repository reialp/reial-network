import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getPesapalToken() {
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
  const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
  const environment = process.env.PESAPAL_ENVIRONMENT || 'production'
  const baseUrl = environment === 'sandbox'
    ? 'https://cybqa.pesapal.com/pesapalv3/api'
    : 'https://pay.pesapal.com/v3/api'

  const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  })

  if (!authResponse.ok) {
    const errorText = await authResponse.text()
    throw new Error(`Authentication failed: ${authResponse.status} ${errorText}`)
  }

  const authData = await authResponse.json()
  if (!authData.token) {
    throw new Error('No authentication token received')
  }

  return { token: authData.token, baseUrl }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('🔍 Request body:', body)

    // ✅ amount is intentionally NOT read from the client anymore
    const { purchaseId, description, email, firstName, lastName, phoneNumber } = body

    if (!purchaseId) {
      console.error('❌ Missing required field: purchaseId')
      return NextResponse.json(
        { error: 'Missing required field: purchaseId' },
        { status: 400 }
      )
    }

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
    const notificationId = process.env.PESAPAL_NOTIFICATION_ID?.trim()
    const environment = process.env.PESAPAL_ENVIRONMENT || 'production'

    console.log('🔍 Environment:', environment)
    console.log('🔍 Consumer Key exists:', !!consumerKey)
    console.log('🔍 Consumer Secret exists:', !!consumerSecret)
    console.log('🔍 Notification ID exists:', !!notificationId)

    if (!consumerKey || !consumerSecret || !notificationId) {
      const missing = []
      if (!consumerKey) missing.push('PESAPAL_CONSUMER_KEY')
      if (!consumerSecret) missing.push('PESAPAL_CONSUMER_SECRET')
      if (!notificationId) missing.push('PESAPAL_NOTIFICATION_ID')

      console.error('❌ Missing PesaPal configuration:', missing.join(', '))
      return NextResponse.json(
        { error: `PesaPal configuration missing: ${missing.join(', ')}` },
        { status: 500 }
      )
    }

    // ✅ Look up the purchase server-side — amount, status, everything comes from here
    const supabase = await createClient()
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, amount_paid, status')
      .eq('id', purchaseId)
      .single()

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', purchaseError)
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    if (purchase.status === 'completed') {
      console.log('⚠️ Purchase already completed, refusing to re-initiate:', purchaseId)
      return NextResponse.json({ error: 'This purchase has already been paid for' }, { status: 400 })
    }

    const amount = purchase.amount_paid

    const { token, baseUrl } = await getPesapalToken()
    console.log('✅ Got Pesapal auth token')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reial-network.vercel.app'

    const paymentPayload = {
      id: purchaseId,
      currency: 'KES',
      amount: Number(amount), // ✅ server-derived
      description: description || 'Reial Network purchase',
      callback_url: `${appUrl}/api/pesapal/callback`,
      notification_id: notificationId,
      billing_address: {
        email_address: email || 'customer@example.com',
        phone_number: phoneNumber || '',
        first_name: firstName || 'Customer',
        last_name: lastName || 'User',
      }
    }

    console.log('📦 Payment payload:', JSON.stringify(paymentPayload))

    const paymentResponse = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(paymentPayload),
    })

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('❌ Payment submission failed:', paymentResponse.status, errorText)
      return NextResponse.json(
        { error: `Payment submission failed: ${paymentResponse.status}. Details: ${errorText}` },
        { status: 500 }
      )
    }

    const paymentData = await paymentResponse.json()
    const redirectUrl = paymentData.redirect_url

    if (!redirectUrl) {
      console.error('❌ No redirect URL:', paymentData)
      return NextResponse.json(
        { error: 'No redirect URL received from PesaPal' },
        { status: 500 }
      )
    }

    console.log('✅ Success! Redirect URL:', redirectUrl)
    return NextResponse.json({
      success: true,
      redirect_url: redirectUrl
    })

  } catch (error: any) {
    console.error('❌ Pesapal error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
