import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { amount, purchaseId, description } = await req.json()

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET
    const environment = process.env.PESAPAL_ENVIRONMENT || 'sandbox'

    // ✅ Use the correct base URL
    // For production: https://pay.pesapal.com/v3
    // For sandbox: https://cybqa.pesapal.com/pesapalv3/api
    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3'

    console.log('🔍 Environment:', environment)
    console.log('🔍 Base URL:', baseUrl)
    console.log('🔍 Amount:', amount)
    console.log('🔍 Purchase ID:', purchaseId)

    // ✅ Step 1: Get OAuth token
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

    // ✅ Check if auth response is OK
    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('❌ Auth failed:', errorText)
      return NextResponse.json({ 
        error: `Auth failed: ${authResponse.status} - ${errorText}` 
      }, { status: 500 })
    }

    const authData = await authResponse.json()
    console.log('✅ Auth successful:', authData)

    const token = authData.token
    if (!token) {
      console.error('❌ No token in response:', authData)
      return NextResponse.json({ error: 'No token received' }, { status: 500 })
    }

    // ✅ Step 2: Submit order
    const paymentResponse = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: purchaseId,
        currency: 'KES',
        amount: Number(amount),
        description: description || 'Reial Network purchase',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/pesapal/ipn`,
        notification_id: null,
        branch: 'Reial Network',
        source: 'web',
      }),
    })

    // ✅ Check if payment response is OK
    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('❌ Payment failed:', errorText)
      return NextResponse.json({ 
        error: `Payment failed: ${paymentResponse.status} - ${errorText}` 
      }, { status: 500 })
    }

    const paymentData = await paymentResponse.json()
    console.log('✅ Payment response:', paymentData)

    const redirectUrl = paymentData.redirect_url
    if (!redirectUrl) {
      console.error('❌ No redirect URL:', paymentData)
      return NextResponse.json({ error: 'No redirect URL from Pesapal' }, { status: 500 })
    }

    console.log('✅ Redirect URL:', redirectUrl)

    return NextResponse.json({ redirect_url: redirectUrl })
  } catch (error: any) {
    console.error('❌ Pesapal error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
