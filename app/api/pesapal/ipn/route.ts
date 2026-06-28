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
      console.error('❌ Missing required fields')
      return NextResponse.json({ error: 'Invalid IPN' }, { status: 400 })
    }

    // ✅ Only process completed payments
    if (status !== 'Completed') {
      console.log('⏳ Payment not completed:', status)
      return NextResponse.json({ message: 'Payment not completed' }, { status: 200 })
    }

    const supabase = await createClient()

    // ✅ Check for duplicate (idempotency) - prevent double processing
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('pesapal_transaction_id', orderTrackingId)
      .single()

    if (existing) {
      console.log('🔄 Duplicate IPN ignored for transaction:', orderTrackingId)
      return NextResponse.json({ message: 'Already processed' }, { status: 200 })
    }

    // ✅ Find the purchase using the merchant reference (which is your purchase ID)
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

    // ✅ Increment sales count for the content
    if (purchase.content_id) {
      try {
        // ✅ Check if the function exists by testing it
        console.log('📊 Calling increment_sales for content:', purchase.content_id)
        
        // ✅ First, check if the function exists
        const { data: funcCheck, error: funcError } = await supabase
          .rpc('increment_sales', { content_id: purchase.content_id })
        
        if (funcError) {
          console.error('❌ RPC error:', funcError)
          console.error('❌ This means the increment_sales function does not exist in Supabase!')
          console.error('❌ Please run the CREATE FUNCTION SQL in Supabase SQL Editor.')
        } else {
          console.log('✅ Sales count incremented for content:', purchase.content_id)
        }
      } catch (rpcError) {
        console.error('❌ RPC error (increment_sales):', rpcError)
        console.error('❌ The increment_sales function does not exist in Supabase.')
        console.error('❌ Please run this SQL in Supabase SQL Editor:')
        console.error(`
          CREATE OR REPLACE FUNCTION increment_sales(content_id UUID)
          RETURNS void AS $$
          BEGIN
            UPDATE content
            SET purchase_count = purchase_count + 1
            WHERE id = content_id;
          END;
          $$ LANGUAGE plpgsql;
        `)
      }
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
