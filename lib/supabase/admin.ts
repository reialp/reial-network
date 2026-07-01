import { createClient } from '@supabase/supabase-js'

/**
 * ✅ Supabase Admin Client
 * This client uses the SERVICE_ROLE_KEY to bypass Row Level Security (RLS).
 * ONLY use this in Server Actions or API Routes that have an admin check.
 */
export const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase Admin environment variables (URL or Service Role Key)')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
