import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    console.log('📦 IPN Raw body:', body)

    const params = new URLSearchParams(body)
    const orderTrackingId = params.get('OrderTrackingId')
    const orderMerchantReference = params.get('OrderMerchantReference')
    const status = params.get('Status')

    console.log('📦 IPN Parsed:', { orderTrackingId, orderMerchantReference, status })

    if (!orderTrackingId || !orderMerchantReference || !status) {
      return NextResponse.json({ error: 'Invalid IPN' }, { status: 400 })
    }

    // ✅ Only process completed payments
    if (status !== 'Completed') {
      console.log('⏳ Payment not completed:', status)
      return NextResponse.json({ message: 'Payment not completed' }, { status: 200 })
    }

    const supabase = await createClient()

    // ✅ Check for duplicate (idempotency)
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('pesapal_transaction_id', orderTrackingId)
      .single()

    if (existing) {
      console.log('🔄 Duplicate IPN ignored')
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }

    // ✅ Find the purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', orderMerchantReference)
      .single()

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', orderMerchantReference)
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // ✅ Update purchase with transaction ID
    const { error: updateError } = await supabase
      .from('purchases')
      .update({ pesapal_transaction_id: orderTrackingId })
      .eq('id', purchase.id)

    if (updateError) {
      console.error('❌ Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // ✅ Increment sales count
    await supabase.rpc('increment_sales', { content_id: purchase.content_id })

    console.log('✅ IPN processed successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ IPN error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return POST(req)
}
