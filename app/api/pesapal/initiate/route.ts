import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { amount, purchaseId, description } = await req.json()
    
    console.log('🔍 Starting payment:', { amount, purchaseId })

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
    const environment = process.env.PESAPAL_ENVIRONMENT || 'production'

    // ✅ Check credentials
    if (!consumerKey || !consumerSecret) {
      console.error('❌ Missing PesaPal credentials')
      return NextResponse.json(
        { error: 'Missing PesaPal credentials' },
        { status: 500 }
      )
    }

    // ✅ Build API URL
    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3'

    console.log('🔍 Base URL:', baseUrl)

    // ✅ Step 1: Get token
    console.log('📡 Getting auth token...')
    
    const authRes = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    })

    if (!authRes.ok) {
      const error = await authRes.text()
      console.error('❌ Auth error:', error)
      return NextResponse.json(
        { error: `Auth failed: ${authRes.status}` },
        { status: 500 }
      )
    }

    const authData = await authRes.json()
    console.log('✅ Auth successful')
    
    const token = authData.token
    if (!token) {
      console.error('❌ No token')
      return NextResponse.json(
        { error: 'No token received' },
        { status: 500 }
      )
    }

    // ✅ Step 2: Submit order
    console.log('📡 Submitting order...')
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reial-network.vercel.app'
    
    const orderPayload = {
      id: purchaseId,
      currency: 'KES',
      amount: Number(amount),
      description: description || 'Reial Network purchase',
      callback_url: `${appUrl}/api/pesapal/callback`, // ✅ UPDATED: Now uses /callback
      branch: 'Reial Network',
      source: 'web',
    }

    console.log('📦 Order:', JSON.stringify(orderPayload))

    const orderRes = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    })

    if (!orderRes.ok) {
      const error = await orderRes.text()
      console.error('❌ Order error:', error)
      return NextResponse.json(
        { error: `Order failed: ${orderRes.status}` },
        { status: 500 }
      )
    }

    const orderData = await orderRes.json()
    console.log('✅ Order successful')

    const redirectUrl = orderData.redirect_url
    if (!redirectUrl) {
      console.error('❌ No redirect URL:', orderData)
      return NextResponse.json(
        { error: 'No redirect URL' },
        { status: 500 }
      )
    }

    console.log('✅ Redirect URL:', redirectUrl)
    
    return NextResponse.json({
      success: true,
      redirect_url: redirectUrl,
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}
