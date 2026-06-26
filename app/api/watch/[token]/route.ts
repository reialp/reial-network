import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('purchases')
      .select('content:content_id(video_url)')
      .eq('watch_token', token)
      .is('revoked_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }

    const videoUrl = (data.content as any)?.video_url
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return NextResponse.json({ videoUrl })
  } catch (error) {
    console.error('Watch API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}