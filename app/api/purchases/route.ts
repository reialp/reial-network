import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const { contentId } = await req.json()

    if (!contentId) {
      return NextResponse.json(
        { error: 'Missing content ID' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the buyer from the logged-in session.
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in' },
        { status: 401 }
      )
    }

    const buyerId = user.id

    // Check whether this buyer already purchased this content.
    const { data: existingPurchase, error: existingError } = await supabase
      .from('purchases')
      .select('id, watch_token, status')
      .eq('buyer_id', buyerId)
      .eq('content_id', contentId)
      .is('revoked_at', null)
      .maybeSingle()

    if (existingError) {
      console.error('Existing purchase lookup failed:', existingError)
      return NextResponse.json(
        { error: 'Could not check existing purchase' },
        { status: 500 }
      )
    }

    if (existingPurchase) {
      // If payment was already completed, send the buyer directly to watch.
      if (existingPurchase.status === 'completed') {
        return NextResponse.json({
          purchaseId: existingPurchase.id,
          watchToken: existingPurchase.watch_token,
          alreadyPurchased: true,
        })
      }

      // Do not create duplicate pending purchases.
      return NextResponse.json({
        purchaseId: existingPurchase.id,
        watchToken: existingPurchase.watch_token,
        alreadyPurchased: false,
        paymentPending: true,
      })
    }

    // Get the content and its price from the database.
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('price, creator_id, status')
      .eq('id', contentId)
      .eq('status', 'approved')
      .single()

    if (contentError || !content) {
      console.error('Content lookup failed:', contentError)
      return NextResponse.json(
        { error: 'Content not found or not approved' },
        { status: 404 }
      )
    }

    const amount = Number(content.price)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid content price' },
        { status: 400 }
      )
    }

    // Revenue policy: creator receives 70%; platform/admin retains 30%.
    // Keep two-decimal precision so both shares add back to the exact amount
    // charged to the buyer.
    const platformFee = Number((amount * 0.30).toFixed(2))
    const creatorEarnings = Number((amount - platformFee).toFixed(2))
    const watchToken = crypto.randomBytes(32).toString('hex')

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        content_id: contentId,
        buyer_id: buyerId,
        amount_paid: amount,
        platform_fee: platformFee,
        creator_earnings: creatorEarnings,
        watch_token: watchToken,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id, watch_token')
      .single()

    if (purchaseError || !purchase) {
      console.error('Purchase creation failed:', purchaseError)
      return NextResponse.json(
        { error: 'Failed to create purchase' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      purchaseId: purchase.id,
      watchToken: purchase.watch_token,
      alreadyPurchased: false,
    })
  } catch (error) {
    console.error('Purchase API error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
