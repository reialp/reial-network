import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('🔍 Request body:', body)
    
    // Destructure necessary fields, adding email/name which are required for PesaPal billing_address
    const { amount, purchaseId, description, email, firstName, lastName, phoneNumber } = body

    if (!amount || !purchaseId) {
      console.error('❌ Missing required fields:', { amount, purchaseId })
      return NextResponse.json(
        { error: 'Missing required fields: amount and purchaseId are mandatory' },
        { status: 400 }
      )
    }

    const consumerKey = process.env.PESAPAL_CONSUMER_KEY?.trim()
    const consumerSecret = process.env.PESAPAL_CONSUMER_SECRET?.trim()
    const notificationId = process.env.PESAPAL_NOTIFICATION_ID?.trim() // Required for V3
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

    // Fixed Production URL (added /api)
    const baseUrl = environment === 'sandbox'
      ? 'https://cybqa.pesapal.com/pesapalv3/api'
      : 'https://pay.pesapal.com/v3/api'

    console.log('🔍 Base URL:', baseUrl)

    // ✅ Step 1: Get OAuth token
    console.log('📡 Getting auth token...')
    
    const authResponse = await fetch(`${baseUrl}/Auth/RequestToken`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
    
    // PesaPal V3 requires specific fields: notification_id and billing_address
    const paymentPayload = {
      id: purchaseId,
      currency: 'KES',
      amount: Number(amount),
      description: description || 'Reial Network purchase',
      callback_url: `${appUrl}/api/pesapal/callback`, // Ensure this matches your route
      notification_id: notificationId,
      billing_address: {
        email_address: email || 'customer@example.com', // At least one of email or phone is required
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
