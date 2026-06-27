import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { amount, purchaseId, description } = await req.json()
    
    console.log('🔍 Payment initiation:', { amount, purchaseId, description })

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
    const environment = process.env.PESAPAL_ENVIRONMENT || 'production'

    console.log('🔍 Environment:', environment)
    console.log('🔍 Consumer Key length:', consumerKey?.length || 0)
    console.log('🔍 Consumer Secret length:', consumerSecret?.length || 0)

    if (!consumerKey || !consumerSecret) {
      console.error('❌ Missing credentials')
      return NextResponse.json(
        { error: 'Missing PesaPal credentials' },
        { status: 500 }
      )
    }

    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3'

    console.log('🔍 Base URL:', baseUrl)

    // ✅ Step 1: Get token
    const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
      }),
    })

    console.log('📡 Auth status:', authResponse.status)

    if (!authResponse.ok) {
      const error = await authResponse.text()
      console.error('❌ Auth error:', error)
      return NextResponse.json(
        { error: `Auth failed: ${authResponse.status}` },
        { status: 500 }
      )
    }

    const authData = await authResponse.json()
    console.log('✅ Auth successful')
    const token = authData.token

    if (!token) {
      console.error('❌ No token')
      return NextResponse.json(
        { error: 'No token received' },
        { status: 500 }
      )
    }

    // ✅ Step 2: Submit order WITHOUT notification_id
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reial-network.vercel.app'
    
    const orderPayload = {
      id: purchaseId,
      currency: 'KES',
      amount: Number(amount),
      description: description || 'Reial Network purchase',
      callback_url: `${appUrl}/api/pesapal/ipn`,
      // ✅ notification_id removed - let PesaPal use the registered IPN
      branch: 'Reial Network',
      source: 'web',
    }

    console.log('📦 Order payload:', JSON.stringify(orderPayload, null, 2))

    const orderResponse = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    })

    console.log('📡 Order status:', orderResponse.status)

    if (!orderResponse.ok) {
      const error = await orderResponse.text()
      console.error('❌ Order error:', error)
      return NextResponse.json(
        { error: `Order failed: ${orderResponse.status}` },
        { status: 500 }
      )
    }

    const orderData = await orderResponse.json()
    console.log('✅ Order successful:', orderData)

    if (!orderData.redirect_url) {
      console.error('❌ No redirect URL')
      return NextResponse.json(
        { error: 'No redirect URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      redirect_url: orderData.redirect_url,
    })

  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}
