import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard'

  console.log('🔍 Auth callback - Code:', !!code, 'Redirect to:', redirectTo)

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Auth callback error:', error)
      return NextResponse.redirect(new URL('/auth/login?error=auth_failed', request.url))
    }
    
    console.log('✅ Auth callback - Session exchanged successfully')
  }

  console.log('🔀 Auth callback - Redirecting to:', redirectTo)
  return NextResponse.redirect(new URL(redirectTo, request.url))
}
