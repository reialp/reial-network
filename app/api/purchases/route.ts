import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const { contentId, buyerId } = await req.json()

    if (!contentId || !buyerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // ✅ Check if already purchased
    const { data: existingPurchase } = await supabase
      .from('purchases')
      .select('watch_token, id')
      .eq('buyer_id', buyerId)
      .eq('content_id', contentId)
      .is('revoked_at', null)
      .maybeSingle()

    if (existingPurchase) {
      return NextResponse.json({
        purchaseId: existingPurchase.id,
        watchToken: existingPurchase.watch_token,
        alreadyPurchased: true,
      })
    }

    // Get content details
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('price, creator_id')
      .eq('id', contentId)
      .single()

    if (contentError || !content) {
      console.error('Content fetch error:', contentError)
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const amount = content.price
    const platformFee = Math.round(amount * 0.15)
    const creatorEarnings = Math.round(amount * 0.85)

    // Generate watch token
    const watchToken = crypto.randomBytes(32).toString('hex')

    // ✅ CRITICAL: Create purchase with status 'pending'
    // ⚠️ DO NOT mark as completed here - only IPN should do that!
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        content_id: contentId,
        buyer_id: buyerId,
        amount_paid: amount,
        platform_fee: platformFee,
        creator_earnings: creatorEarnings,
        watch_token: watchToken,
        status: 'pending', // ← CRITICAL: Always start as pending!
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (purchaseError) {
      console.error('Purchase insert error:', purchaseError)
      return NextResponse.json({ error: 'Failed to create purchase: ' + purchaseError.message }, { status: 500 })
    }

    return NextResponse.json({
      purchaseId: purchase.id,
      watchToken: watchToken,
      alreadyPurchased: false,
    })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 })
  }
}
