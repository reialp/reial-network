import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

export async function POST(req: Request) {
  try {
    const body = await req.text()
    console.log('📦 IPN Raw body:', body)

    const params = new URLSearchParams(body)
    const orderTrackingId = params.get('OrderTrackingId')
    const orderMerchantReference = params.get('OrderMerchantReference')

    console.log('📦 IPN Parsed (unverified hint):', {
      orderTrackingId,
      orderMerchantReference,
      claimedStatus: params.get('Status'),
    })

    if (!orderTrackingId || !orderMerchantReference) {
      console.error('❌ Missing required fields')
      return NextResponse.json({ error: 'Invalid IPN' }, { status: 400 })
    }

    // ✅ Never trust the posted Status — always re-verify with Pesapal directly
    let verified
    try {
      verified = await verifyTransactionStatus(orderTrackingId)
    } catch (verifyErr: any) {
      console.error('❌ Verification call failed:', verifyErr.message)
      // Return 200 so Pesapal retries the IPN later, but don't mark anything completed
      return NextResponse.json({ message: 'Verification failed, will retry' }, { status: 200 })
    }

    console.log('🔒 Verified status from Pesapal:', verified.payment_status_description, 'amount:', verified.amount)

   // status_code: 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED — safer than
// string-matching payment_status_description, whose casing isn't consistent
// even in Pesapal's own docs ("COMPLETED" in prose, "Failed" in their sample).
if (verified.status_code !== 1) {
  console.log('⏳ Not completed per Pesapal. status_code:', verified.status_code, 'description:', verified.payment_status_description)
  return NextResponse.json({ message: 'Payment not completed' }, { status: 200 })
}
    const supabase = await createClient()

    // ✅ Check for duplicate
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('pesapal_transaction_id', orderTrackingId)
      .single()

    if (existing) {
      console.log('🔄 Duplicate IPN ignored for transaction:', orderTrackingId)
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }

    // ✅ Find the purchase
    console.log('🔍 Looking for purchase with ID:', orderMerchantReference)

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', orderMerchantReference)
      .single()

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', orderMerchantReference)
      console.error('❌ Error details:', purchaseError)
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    console.log('✅ Purchase found:', purchase.id)
    console.log('📊 Content ID:', purchase.content_id)
    console.log('📊 Expected amount:', purchase.amount_paid)

    // ✅ Cross-check the amount Pesapal actually confirms against what we expect.
    // Guards against a tampered `amount` reaching Pesapal in the first place.
    const expectedAmount = Number(purchase.amount_paid)
    const confirmedAmount = Number(verified.amount)

    if (isNaN(confirmedAmount) || confirmedAmount < expectedAmount) {
      console.error('❌ Amount mismatch. Expected:', expectedAmount, 'Confirmed:', confirmedAmount)
      // Flag instead of silently completing — do NOT mark as completed
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

    // ✅ Update purchase with transaction ID
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

    console.log('✅ Purchase updated to completed')

    // ✅ Increment sales count
    if (purchase.content_id) {
      console.log('📊 Attempting to increment sales for content:', purchase.content_id)

      try {
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('increment_sales', { content_id: purchase.content_id })

        if (rpcError) {
          console.error('❌ RPC error:', rpcError)
          console.error('❌ Function may not exist. Please run CREATE FUNCTION in Supabase.')
        } else {
          console.log('✅ Sales count incremented successfully for content:', purchase.content_id)
          console.log('📊 RPC result:', rpcResult)
        }
      } catch (error) {
        console.error('❌ Error calling increment_sales:', error)
      }

      const { data: updatedContent } = await supabase
        .from('content')
        .select('id, title, purchase_count')
        .eq('id', purchase.content_id)
        .single()

      console.log('📊 Updated content:', updatedContent)
    } else {
      console.error('❌ No content_id found in purchase!')
    }

    console.log('✅ IPN processed successfully for purchase:', purchase.id)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ IPN error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
