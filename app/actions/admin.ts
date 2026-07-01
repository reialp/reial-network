'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getAllContent() {
  try {
    const supabase = await createClient()

    // ✅ Check if user is admin
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { error: 'Unauthorized', content: [] }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return { error: 'Forbidden', content: [] }
    }

    // ✅ Fetch ALL content from ALL creators
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false })

    if (contentError) {
      return { error: contentError.message, content: [] }
    }

    // ✅ Get creator names
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

    return { content: allContent, error: null }
  } catch (error) {
    return { error: String(error), content: [] }
  }
}
