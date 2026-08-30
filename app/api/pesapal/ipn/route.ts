import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// --- Shared IPN logic ---
async function processIPN(orderTrackingId: string | null, orderMerchantReference: string | null) {
  // 1. Validate inputs
  if (!orderTrackingId || !orderMerchantReference) {
    console.error('❌ Missing OrderTrackingId or OrderMerchantReference')
    return NextResponse.json({ error: 'Invalid IPN' }, { status: 400 })
  }

  console.log('📦 IPN received:', { orderTrackingId, orderMerchantReference })

  // 2. Re-verify with Pesapal (don't trust the webhook status)
  let verified
  try {
    verified = await verifyTransactionStatus(orderTrackingId)
  } catch (verifyErr: any) {
    console.error('❌ Verification failed:', verifyErr.message)
    // Return 200 so Pesapal retries later
    return NextResponse.json({ message: 'Verification failed, will retry' }, { status: 200 })
  }

  console.log('🔒 Verified status from Pesapal:', verified.payment_status_description, 'status_code:', verified.status_code)

  // 3. 🔴 ONLY mark as completed if status_code is 1 (COMPLETED)
  if (verified.status_code !== 1) {
    console.log('⏳ Not completed. status_code:', verified.status_code)
    return NextResponse.json({ message: 'Payment not completed' }, { status: 200 })
  }

  const supabase = await createClient()

  // 4. Check for duplicate IPN
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('pesapal_transaction_id', orderTrackingId)
    .single()

  if (existing) {
    console.log('🔄 Duplicate IPN ignored for transaction:', orderTrackingId)
    return NextResponse.json({ message: 'Already processed' }, { status: 200 })
  }

  // 5. Find the purchase
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('*')
    .eq('id', orderMerchantReference)
    .single()

  if (purchaseError || !purchase) {
    console.error('❌ Purchase not found:', orderMerchantReference)
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  }

  // 6. Cross-check amount
  const expectedAmount = Number(purchase.amount_paid)
  const confirmedAmount = Number(verified.amount)

  if (isNaN(confirmedAmount) || confirmedAmount < expectedAmount) {
    console.error('❌ Amount mismatch. Expected:', expectedAmount, 'Confirmed:', confirmedAmount)
    await supabase
      .from('purchases')
      .update({
        pesapal_transaction_id: orderTrackingId,
        status: 'flagged_amount_mismatch',
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchase.id)
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }

  // 7. ✅ Update purchase to 'completed'
  const { error: updateError } = await supabase
    .from('purchases')
    .update({
      pesapal_transaction_id: orderTrackingId,
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('id', purchase.id)

  if (updateError) {
    console.error('❌ Update error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log('✅ Purchase updated to completed:', purchase.id)

  // 8. Increment sales (optional)
  if (purchase.content_id) {
    try {
      await supabase.rpc('increment_sales', { content_id: purchase.content_id })
      console.log('✅ Sales incremented for content:', purchase.content_id)
    } catch (err) {
      console.error('❌ RPC error:', err)
    }
  }

  return NextResponse.json({ success: true })
}

// --- Helper: Get Pesapal Token ---
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
    throw new Error(`Auth failed: ${authResponse.status} ${errorText}`)
  }

  const authData = await authResponse.json()
  if (!authData.token) throw new Error('No token in Pesapal auth response')
  return { token: authData.token, baseUrl }
}

// --- Helper: Verify Transaction ---
async function verifyTransactionStatus(orderTrackingId: string) {
  const { token, baseUrl } = await getPesapalToken()
  const res = await fetch(
    `${baseUrl}/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
  )
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`GetTransactionStatus failed: ${res.status} ${errorText}`)
  }
  return res.json()
}

// --- Route Handlers ---

// 🟢 GET: Pesapal sends IPN as query params (based on your registration)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const orderTrackingId = url.searchParams.get('OrderTrackingId')
    const orderMerchantReference = url.searchParams.get('OrderMerchantReference')
    
    console.log('📩 GET IPN received with query:', { orderTrackingId, orderMerchantReference })
    return processIPN(orderTrackingId, orderMerchantReference)
  } catch (error: any) {
    console.error('❌ GET IPN error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// 🟡 POST: Handles IPN if sent as form data (fallback)
export async function POST(req: Request) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const orderTrackingId = params.get('OrderTrackingId')
    const orderMerchantReference = params.get('OrderMerchantReference')
    
    console.log('📩 POST IPN received with body:', { orderTrackingId, orderMerchantReference })
    return processIPN(orderTrackingId, orderMerchantReference)
  } catch (error: any) {
    console.error('❌ POST IPN error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
