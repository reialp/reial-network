import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderMerchantReference = url.searchParams.get('OrderMerchantReference')

  console.log('🔍 Callback received for purchase:', orderMerchantReference)

  if (!orderMerchantReference) {
    return NextResponse.redirect(new URL('/library?payment=failed', req.url))
  }

  try {
    const supabase = await createClient()
    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('watch_token, status')
      .eq('id', orderMerchantReference)
      .single()

    if (error || !purchase) {
      console.error('❌ Purchase not found:', error)
      return NextResponse.redirect(new URL('/library?payment=failed', req.url))
    }

    // ✅ Only the DB status (set exclusively by the verified IPN) decides this
    if (purchase.status === 'completed') {
      const watchUrl = `/watch/${purchase.watch_token}`
      console.log('✅ Redirecting to watch:', watchUrl)
      return NextResponse.redirect(new URL(watchUrl, req.url))
    }

    // Payment may still be processing — the IPN can lag slightly behind the
    // browser redirect. Send to a pending page rather than assuming failure.
    console.log('⏳ Purchase not yet completed, status:', purchase.status)
    return NextResponse.redirect(
      new URL(`/library?payment=pending&ref=${orderMerchantReference}`, req.url)
    )
  } catch (error) {
    console.error('❌ Error processing callback:', error)
    return NextResponse.redirect(new URL('/library?payment=failed', req.url))
  }
}
