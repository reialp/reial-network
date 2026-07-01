'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

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

// ✅ Types
interface ContentItem {
  id: string
  title: string
  description: string
  thumbnail_url: string
  video_url: string
  trailer_url: string
  category: string
  price: number
  release_year: number
  language: string
  subtitles: string
  status: string
  views: number
  purchase_count: number
  created_at: string
  slug: string | null
  creator_id: string
  creator_name?: string
}

interface ApiResponse<T = any> {
  content?: T[]
  error?: string | null
  success?: boolean
}

// ✅ Get all content
export async function getAllContent(): Promise<ApiResponse<ContentItem>> {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return { error: 'Not authenticated', content: [] }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) {
      return { error: 'Access denied: Admin only', content: [] }
    }

    const adminSupabase = createAdminClient()
    const { data: content, error: contentError } = await adminSupabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false })

    if (contentError) {
      return { error: contentError.message, content: [] }
    }

    // ✅ Get creator names
    const creatorIds = [...new Set((content || []).map((c: ContentItem) => c.creator_id).filter(Boolean))]
    let creatorNames: Record<string, string> = {}
    
    if (creatorIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds)
      
      if (profiles) {
        creatorNames = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || 'Unknown Creator'
          return acc
        }, {})
      }
    }

    const allContent: ContentItem[] = (content || []).map((item: any) => ({
      ...item,
      creator_name: creatorNames[item.creator_id] || 'Unknown Creator'
    }))

    return { content: allContent, error: null }
  } catch (error: any) {
    console.error('getAllContent error:', error)
    return { error: error.message || 'Internal error', content: [] }
  }
}

// ✅ Approve content
export async function approveContent(contentId: string): Promise<ApiResponse> {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'approved' })
      .eq('id', contentId)

    if (error) {
      return { error: error.message, success: false }
    }
    
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('approveContent error:', error)
    return { error: error.message || 'Failed to approve content', success: false }
  }
}

// ✅ Reject content
export async function rejectContent(contentId: string): Promise<ApiResponse> {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'rejected' })
      .eq('id', contentId)

    if (error) {
      return { error: error.message, success: false }
    }
    
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('rejectContent error:', error)
    return { error: error.message || 'Failed to reject content', success: false }
  }
}

// ✅ Revoke approval
export async function revokeApproval(contentId: string): Promise<ApiResponse> {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'pending' })
      .eq('id', contentId)

    if (error) {
      return { error: error.message, success: false }
    }
    
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('revokeApproval error:', error)
    return { error: error.message || 'Failed to revoke approval', success: false }
  }
}

// ✅ Delete content
export async function deleteContent(contentId: string): Promise<ApiResponse> {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .delete()
      .eq('id', contentId)

    if (error) {
      return { error: error.message, success: false }
    }
    
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('deleteContent error:', error)
    return { error: error.message || 'Failed to delete content', success: false }
  }
}

// ✅ Confirm transaction
export async function confirmTransaction(
  transactionId: string, 
  confirmationCode: string
): Promise<ApiResponse> {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('purchases')
      .update({ 
        status: 'completed', 
        pesapal_transaction_id: confirmationCode.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)

    if (error) {
      return { error: error.message, success: false }
    }
    
    revalidatePath('/admin')
    
    // ✅ Also increment sales count
    if (transactionId) {
      const { data: purchase } = await adminSupabase
        .from('purchases')
        .select('content_id')
        .eq('id', transactionId)
        .single()
      
      if (purchase?.content_id) {
        await adminSupabase.rpc('increment_sales', { content_id: purchase.content_id })
      }
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('confirmTransaction error:', error)
    return { error: error.message || 'Failed to confirm transaction', success: false }
  }
}

// ✅ Process payout
export async function processPayout(payoutId: string): Promise<ApiResponse> {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('payout_requests')
      .update({ 
        status: 'processed', 
        processed_at: new Date().toISOString() 
      })
      .eq('id', payoutId)

    if (error) {
      return { error: error.message, success: false }
    }
    
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('processPayout error:', error)
    return { error: error.message || 'Failed to process payout', success: false }
  }
}
