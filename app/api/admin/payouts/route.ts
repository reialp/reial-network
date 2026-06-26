import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const payoutId = formData.get('payoutId') as string

    if (!payoutId) {
      return NextResponse.json({ error: 'Missing payout ID' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check admin
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('payout_requests')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', payoutId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.redirect(new URL('/admin', req.url))
  } catch (error) {
    console.error('Payout error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}