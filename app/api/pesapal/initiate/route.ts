import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('🔍 Request body:', body)
    
    const { amount, purchaseId, description } = body

    if (!amount || !purchaseId) {
      console.error('❌ Missing required fields:', { amount, purchaseId })
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET
    const environment = process.env.PESAPAL_ENVIRONMENT || 'sandbox'

    console.log('🔍 Environment:', environment)
    console.log('🔍 Consumer Key exists:', !!consumerKey)
    console.log('🔍 Consumer Secret exists:', !!consumerSecret)
    console.log('🔍 Consumer Key length:', consumerKey?.length || 0)
    console.log('🔍 Consumer Secret length:', consumerSecret?.length || 0)

    if (!consumerKey || !consumerSecret) {
      console.error('❌ Missing PesaPal credentials')
      return NextResponse.json(
        { error: 'PesaPal credentials not configured' },
        { status: 500 }
      )
    }

    // ✅ Use the CORRECT base URL for your environment
    let baseUrl
    if (environment === 'sandbox') {
      baseUrl = 'https://cybqa.pesapal.com/pesapalv3/api'
    } else {
      baseUrl = 'https://pay.pesapal.com/v3'
    }

    console.log('🔍 Base URL:', baseUrl)
    console.log('🔍 Amount:', amount)
    console.log('🔍 Purchase ID:', purchaseId)

    // ✅ Step 1: Get OAuth token with proper error handling
    console.log('📡 Getting auth token...')
    
    const authPayload = {
      consumer_key: consumerKey.trim(),
      consumer_secret: consumerSecret.trim(),
    }
    console.log('📦 Auth payload:', { ...authPayload, consumer_secret: '***hidden***' })

    let authResponse
    try {
      authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authPayload),
      })
    } catch (fetchError) {
      console.error('❌ Network error:', fetchError)
      return NextResponse.json(
        { error: 'Network error connecting to PesaPal' },
        { status: 500 }
      )
    }

    console.log('📡 Auth response status:', authResponse.status)

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('❌ Auth failed:', authResponse.status, errorText)
      return NextResponse.json(
        { error: `Authentication failed: ${authResponse.status} - ${errorText}` },
        { status: 500 }
      )
    }

    // ✅ Get response text
    const responseText = await authResponse.text()
    console.log('📦 Auth response length:', responseText.length)
    
    if (!responseText || responseText.trim().length === 0) {
      console.error('❌ Empty response from PesaPal')
      return NextResponse.json(
        { error: 'Empty response from PesaPal - check your credentials' },
        { status: 500 }
      )
    }

    console.log('📦 Auth response preview:', responseText.substring(0, 100))

    let authData
    try {
      authData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('❌ Failed to parse auth response:', responseText)
      return NextResponse.json(
        { error: 'Invalid response from PesaPal' },
        { status: 500 }
      )
    }

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
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://reial-network.vercel.app'
    console.log('🔍 App URL:', appUrl)
    
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
    
    console.log('📦 Payment payload:', JSON.stringify(paymentPayload))

    let paymentResponse
    try {
      paymentResponse = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(paymentPayload),
      })
    } catch (fetchError) {
      console.error('❌ Network error submitting payment:', fetchError)
      return NextResponse.json(
        { error: 'Network error submitting payment to PesaPal' },
        { status: 500 }
      )
    }

    console.log('📡 Payment response status:', paymentResponse.status)

    // ✅ Get the response text first
    const paymentResponseText = await paymentResponse.text()
    console.log('📦 Payment response length:', paymentResponseText.length)

    if (!paymentResponse.ok) {
      console.error('❌ Payment submission failed:', paymentResponse.status, paymentResponseText)
      return NextResponse.json(
        { error: `Payment submission failed: ${paymentResponse.status} - ${paymentResponseText}` },
        { status: 500 }
      )
    }

    if (!paymentResponseText || paymentResponseText.trim().length === 0) {
      console.error('❌ Empty payment response from PesaPal')
      return NextResponse.json(
        { error: 'Empty response from PesaPal' },
        { status: 500 }
      )
    }

    let paymentData
    try {
      paymentData = JSON.parse(paymentResponseText)
    } catch (parseError) {
      console.error('❌ Failed to parse payment response:', paymentResponseText)
      return NextResponse.json(
        { error: 'Invalid payment response from PesaPal' },
        { status: 500 }
      )
    }

    console.log('✅ Payment response received:', JSON.stringify(paymentData, null, 2))

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
