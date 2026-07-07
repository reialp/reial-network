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

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) throw new Error('Access denied: Admin only')

  return session.user.id
}

export async function getAllContent() {
  try {
    await requireAdmin()
    const adminSupabase = createAdminClient()

    const { data: content, error: contentError } = await adminSupabase
      .from('content')
      .select('*')
      .order('created_at', { ascending: false })

    if (contentError) return { error: contentError.message, content: [] }

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
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error), content: [] }
  }
}

export async function approveContent(contentId: string) {
  try {
    await requireAdmin()
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'approved' })
      .eq('id', contentId)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}

export async function rejectContent(contentId: string) {
  try {
    await requireAdmin()
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'rejected' })
      .eq('id', contentId)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}

export async function revokeApproval(contentId: string) {
  try {
    await requireAdmin()
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .update({ status: 'pending' })
      .eq('id', contentId)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}

export async function deleteContent(contentId: string) {
  try {
    await requireAdmin()
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('content')
      .delete()
      .eq('id', contentId)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}

export async function confirmTransaction(transactionId: string, confirmationCode: string) {
  try {
    const adminId = await requireAdmin()

    if (!confirmationCode?.trim()) {
      throw new Error('Confirmation code is required')
    }

    const adminSupabase = createAdminClient()

    const { data: purchase, error: fetchError } = await adminSupabase
      .from('purchases')
      .select('amount_paid')
      .eq('id', transactionId)
      .single()

    if (fetchError || !purchase) throw new Error('Transaction not found')

    const PLATFORM_FEE_PERCENTAGE = 0.15
    const amountPaid = Number(purchase.amount_paid || 0)
    const platformFee = Number((amountPaid * PLATFORM_FEE_PERCENTAGE).toFixed(2))
    const creatorEarnings = Number((amountPaid - platformFee).toFixed(2))

    const { error } = await adminSupabase
      .from('purchases')
      .update({
        status: 'completed',
        platform_fee: platformFee,
        creator_earnings: creatorEarnings,
        pesapal_transaction_id: confirmationCode.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}

export async function processPayout(payoutId: string) {
  try {
    await requireAdmin()
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from('payout_requests')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', payoutId)

    if (error) throw new Error(error.message)
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}
