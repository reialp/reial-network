import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    console.log('📦 Request body:', body)
    
    const { amount, purchaseId, description } = JSON.parse(body)

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET
    const environment = process.env.PESAPAL_ENVIRONMENT || 'sandbox'

    console.log('🔍 Environment:', environment)
    console.log('🔍 Consumer Key:', consumerKey ? '✅ Present' : '❌ Missing')
    console.log('🔍 Consumer Secret:', consumerSecret ? '✅ Present' : '❌ Missing')

    if (!consumerKey || !consumerSecret) {
      console.error('❌ Pesapal credentials missing')
      return NextResponse.json({ error: 'Pesapal not configured' }, { status: 500 })
    }

    // ✅ CORRECT API endpoints
    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3'

    console.log('🔍 Base URL:', baseUrl)

    // Step 1: Get OAuth token
    console.log('🔄 Getting OAuth token...')
    const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    })

    const authText = await authResponse.text()
    console.log('📦 Auth response:', authText)

    if (!authResponse.ok) {
      console.error('❌ Auth error:', authText)
      return NextResponse.json({ error: 'Failed to authenticate with Pesapal: ' + authText }, { status: 500 })
    }

    let authData
    try {
      authData = JSON.parse(authText)
    } catch {
      console.error('❌ Failed to parse auth response:', authText)
      return NextResponse.json({ error: 'Invalid auth response from Pesapal' }, { status: 500 })
    }

    const token = authData.token
    if (!token) {
      console.error('❌ No token in auth response:', authData)
      return NextResponse.json({ error: 'No token received from Pesapal' }, { status: 500 })
    }

    console.log('✅ Auth token received')

    // Step 2: Initiate payment
    console.log('🔄 Initiating payment...')
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

    const paymentText = await paymentResponse.text()
    console.log('📦 Payment response:', paymentText)

    if (!paymentResponse.ok) {
      console.error('❌ Payment error:', paymentText)
      return NextResponse.json({ error: 'Payment initiation failed: ' + paymentText }, { status: 500 })
    }

    let paymentData
    try {
      paymentData = JSON.parse(paymentText)
    } catch {
      console.error('❌ Failed to parse payment response:', paymentText)
      return NextResponse.json({ error: 'Invalid payment response from Pesapal' }, { status: 500 })
    }

    const redirectUrl = paymentData.redirect_url
    if (!redirectUrl) {
      console.error('❌ No redirect URL in payment response:', paymentData)
      return NextResponse.json({ error: 'No redirect URL returned from Pesapal' }, { status: 500 })
    }

    console.log('✅ Redirect URL:', redirectUrl)

    return NextResponse.json({ redirect_url: redirectUrl })
  } catch (error: any) {
    console.error('❌ Pesapal error:', error)
    return NextResponse.json({ 
      error: 'Internal server error: ' + (error.message || 'Unknown error') 
    }, { status: 500 })
  }
}
