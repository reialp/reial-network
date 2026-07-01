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

export async function getAdminDashboardData() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Not authenticated' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()

    if (!profile?.is_admin) return { error: 'Access denied: Admin only' }

    const adminSupabase = createAdminClient()

    // Execute all queries in parallel for maximum speed
    const [contentRes, payoutsRes, transactionsRes, purchasesRes, pendingPayoutsRes] = await Promise.all([
      adminSupabase.from('content').select('*, profiles:creator_id(full_name)').order('created_at', { ascending: false }),
      adminSupabase.from('payout_requests').select('*, profiles(full_name)').order('requested_at', { ascending: false }),
      adminSupabase.from('purchases').select('*, content:content_id(title), buyer:buyer_id(email)').order('created_at', { ascending: false }),
      adminSupabase.from('purchases').select('platform_fee, creator_earnings'),
      adminSupabase.from('payout_requests').select('amount').eq('status', 'pending')
    ])

    if (contentRes.error) throw contentRes.error

    const allContent = (contentRes.data || []).map((item: any) => ({
      ...item,
      creator_name: item.profiles?.full_name || 'Unknown Creator'
    }))

    // Calculate Stats on the server
    const totalSales = allContent.reduce((sum, c) => sum + (c.purchase_count || 0), 0)
    const totalRevenue = allContent.reduce((sum, c) => sum + (c.price * (c.purchase_count || 0)), 0)
    const pendingSubmissions = allContent.filter((c: any) => c.status === 'pending').length
    const totalPlatformFees = purchasesRes.data?.reduce((sum, p) => sum + (p.platform_fee || 0), 0) || 0
    const totalPaidToCreators = purchasesRes.data?.reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0
    const pendingPayouts = pendingPayoutsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0

    return {
      content: allContent,
      payouts: payoutsRes.data || [],
      transactions: transactionsRes.data || [],
      stats: {
        totalFilms: allContent.length,
        totalSales,
        totalRevenue,
        totalPlatformFees,
        totalPaidToCreators,
        pendingPayouts,
        pendingSubmissions,
      },
      error: null
    }
  } catch (error: any) {
    return { error: error.message || JSON.stringify(error) }
  }
}

// ... rest of the functions (approve, reject, etc.) remain the same
export async function approveContent(contentId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase.from('content').update({ status: 'approved' }).eq('id', contentId)
    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function rejectContent(contentId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase.from('content').update({ status: 'rejected' }).eq('id', contentId)
    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function revokeApproval(contentId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase.from('content').update({ status: 'pending' }).eq('id', contentId)
    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteContent(contentId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase.from('content').delete().eq('id', contentId)
    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function confirmTransaction(transactionId: string, confirmationCode: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase.from('purchases').update({ 
      status: 'completed', 
      pesapal_transaction_id: confirmationCode.trim(),
      updated_at: new Date().toISOString()
    }).eq('id', transactionId)
    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function processPayout(payoutId: string) {
  try {
    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase.from('payout_requests').update({ 
      status: 'processed', 
      processed_at: new Date().toISOString() 
    }).eq('id', payoutId)
    if (error) throw error
    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
