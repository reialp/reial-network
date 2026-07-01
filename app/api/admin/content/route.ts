import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // ✅ Check if user is admin
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

    // ✅ Fetch ALL content from ALL creators (no filters!)
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false })

    if (contentError) {
      console.error('Content fetch error:', contentError)
      return NextResponse.json({ error: contentError.message }, { status: 500 })
    }

    // ✅ Get creator names separately
    const creatorIds = [...new Set((content || []).map(c => c.creator_id).filter(Boolean))]
    
    let creatorNames: Record<string, string> = {}
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds)
      
      if (profiles) {
        creatorNames = profiles.reduce((acc, p) => {
          acc[p.id] = p.full_name || 'Unknown Creator'
          return acc
        }, {} as Record<string, string>)
      }
    }

    // ✅ Map content with creator names
    const allContent = (content || []).map((item: any) => ({
      ...item,
      creator_name: creatorNames[item.creator_id] || 'Unknown Creator'
    }))

    console.log('📊 API - Total content:', allContent.length)
    console.log('📊 API - Pending content:', allContent.filter((c: any) => c.status === 'pending').length)

    return NextResponse.json({ content: allContent })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
