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
    console.log('📊 Amount:', purchase.amount_paid)

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
        // ✅ Try calling the function
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
      
      // ✅ Verify the update worked
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
