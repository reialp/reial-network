import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('🔍 Request body:', body)
    
    const { amount, purchaseId, description } = body

    if (!amount || !purchaseId) {
      console.error('❌ Missing required fields:', { amount, purchaseId })
      return NextResponse.json(
        { error: 'Missing required fields: amount and purchaseId are required' },
        { status: 400 }
      )
    }

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET
    const environment = process.env.PESAPAL_ENVIRONMENT || 'sandbox'

    if (!consumerKey || !consumerSecret) {
      console.error('❌ Missing PesaPal credentials')
      return NextResponse.json(
        { error: 'PesaPal credentials not configured' },
        { status: 500 }
      )
    }

    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3'

    console.log('🔍 Environment:', environment)
    console.log('🔍 Base URL:', baseUrl)
    console.log('🔍 Amount:', amount)
    console.log('🔍 Purchase ID:', purchaseId)

    // ✅ Step 1: Get OAuth token
    console.log('📡 Getting auth token...')
    const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('❌ Auth failed:', authResponse.status, errorText)
      return NextResponse.json(
        { error: `Authentication failed: ${authResponse.status}` },
        { status: 500 }
      )
    }

    const authData = await authResponse.json()
    console.log('✅ Auth successful')
    const token = authData.token

    if (!token) {
      console.error('❌ No token in response:', authData)
      return NextResponse.json(
        { error: 'No authentication token received' },
        { status: 500 }
      )
    }

    // ✅ Step 2: Submit order to PesaPal
    console.log('📡 Submitting order to PesaPal...')
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const paymentPayload = {
      id: purchaseId,
      currency: 'KES',
      amount: Number(amount),
      description: description || 'Reial Network purchase',
      callback_url: `${appUrl}/api/pesapal/ipn`,
      notification_id: null,
      branch: 'Reial Network',
      source: 'web',
    }
    
    console.log('📦 Payment payload:', paymentPayload)

    const paymentResponse = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(paymentPayload),
    })

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('❌ Payment submission failed:', paymentResponse.status, errorText)
      return NextResponse.json(
        { error: `Payment submission failed: ${paymentResponse.status}` },
        { status: 500 }
      )
    }

    const paymentData = await paymentResponse.json()
    console.log('✅ Payment response received:', paymentData)

    const redirectUrl = paymentData.redirect_url

    if (!redirectUrl) {
      console.error('❌ No redirect URL:', paymentData)
      return NextResponse.json(
        { error: 'No redirect URL received from PesaPal' },
        { status: 500 }
      )
    }

    console.log('✅ Redirect URL:', redirectUrl)
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
