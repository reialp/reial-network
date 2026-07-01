'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Helper to create admin client inside the action
const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase Admin environment variables')
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function getAllContent() {
  try {
    const supabase = await createClient()

    // 1. Verify the requester is actually an admin
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Unauthorized', content: [] }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) return { error: 'Forbidden', content: [] }

    // 2. Use Admin Client to bypass RLS and fetch ALL content
    const adminSupabase = createAdminClient()
    
    const { data: content, error: contentError } = await adminSupabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false })

    if (contentError) return { error: contentError.message, content: [] }

    // 3. Get creator names
    const creatorIds = [...new Set((content || []).map(c => c.creator_id).filter(Boolean))]
    let creatorNames: Record<string, string> = {}
    
    if (creatorIds.length > 0) {
      const { data: profiles } = await adminSupabase
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

export async function approveContent(contentId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'approved', is_reviewed: true })
      .eq('id', contentId)

    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { error: String(error) }
  }
}

export async function rejectContent(contentId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'rejected', is_reviewed: true })
      .eq('id', contentId)

    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    return { error: String(error) }
  }
}
