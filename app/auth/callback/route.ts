import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  let redirectTo = requestUrl.searchParams.get('redirectTo') || '/'
  const intent = requestUrl.searchParams.get('intent')

  // If intent is present and redirectTo is just home, maybe adjust it
  if (intent === 'creator' && redirectTo === '/') {
    redirectTo = '/profile'
  }

  console.log('🔍 Auth callback - Code:', !!code, 'Redirect to:', redirectTo, 'Intent:', intent)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Auth callback error:', error)
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url))
    }
    
    console.log('✅ Auth callback - Session exchanged successfully')
  }

  // Ensure redirectTo is a valid URL or path
  const finalUrl = new URL(redirectTo, request.url)
  
  // If we had an intent, we might want to pass it along if the destination is a page that needs it
  if (intent && !finalUrl.searchParams.has('intent')) {
    finalUrl.searchParams.set('intent', intent)
  }

  console.log('🔀 Auth callback - Redirecting to:', finalUrl.toString())
  return NextResponse.redirect(finalUrl)
}
