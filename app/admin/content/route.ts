import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
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

    // ✅ Use raw SQL to fetch ALL content with creator names
    const { data: contentData, error: contentError } = await supabase
      .rpc('get_all_content_with_creators')

    // If the RPC doesn't exist, use a simpler approach
    if (contentError) {
      // ✅ Fallback: Fetch content and profiles separately
      const { data: content } = await supabase
        .from('content')
        .select('*')
        .order('created_at', { ascending: false })

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

      const allContent = (content || []).map((item: any) => ({
        ...item,
        creator_name: creatorNames[item.creator_id] || 'Unknown Creator'
      }))

      return NextResponse.json({ content: allContent })
    }

    return NextResponse.json({ content: contentData })
  } catch (error) {
    console.error('Admin API error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
