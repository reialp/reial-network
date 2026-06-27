import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderTrackingId = url.searchParams.get('OrderTrackingId')
  const orderMerchantReference = url.searchParams.get('OrderMerchantReference')
  const status = url.searchParams.get('Status')

  console.log('🔍 Callback received:', { orderTrackingId, orderMerchantReference, status })

  if (status === 'Completed') {
    try {
      const supabase = await createClient()

      // ✅ Find the purchase using the merchant reference (purchase ID)
      const { data: purchase, error } = await supabase
        .from('purchases')
        .select('watch_token, content_id')
        .eq('id', orderMerchantReference)
        .single()

      if (error || !purchase) {
        console.error('❌ Purchase not found:', error)
        // Redirect to library as fallback
        return NextResponse.redirect(new URL('/library?payment=success', req.url))
      }

      // ✅ Redirect to watch page using the watch token
      const watchUrl = `/watch/${purchase.watch_token}`
      console.log('✅ Redirecting to watch:', watchUrl)
      return NextResponse.redirect(new URL(watchUrl, req.url))

    } catch (error) {
      console.error('❌ Error processing callback:', error)
      // Redirect to library as fallback
      return NextResponse.redirect(new URL('/library?payment=success', req.url))
    }
  } else {
    // Payment failed
    return NextResponse.redirect(new URL('/library?payment=failed', req.url))
  }
}
