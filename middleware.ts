import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ✅ Log all cookies for debugging
  console.log('🔍 All cookies:', request.cookies.getAll().map(c => c.name))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session }, error } = await supabase.auth.getSession()

  // ✅ Log session status
  console.log('🔍 Session exists:', !!session)
  if (error) {
    console.error('❌ Session error:', error)
  }

  const pathname = request.nextUrl.pathname

  // ✅ Public routes (no login required)
  const isPublic =
    pathname === '/' ||
    pathname === '/auth/login' ||
    pathname === '/auth/signup' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/reset-password' ||
    pathname.startsWith('/explore') ||
    pathname.startsWith('/film/') ||
    pathname.startsWith('/creator/')

  // ✅ Protected routes (login required)
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout/') ||
    pathname.startsWith('/watch/')

  // ✅ Creator-only routes (login + terms + creator status required)
  const isCreatorRoute =
    pathname.startsWith('/upload')

  // ✅ If protected and no session, redirect to login with redirectTo
  if (isProtected && !session) {
    const redirectTo = encodeURIComponent(pathname + request.nextUrl.search)
    console.log('🔀 Middleware: Redirecting to login with:', redirectTo)
    return NextResponse.redirect(new URL(`/auth/login?redirectTo=${redirectTo}`, request.url))
  }

  // ✅ If logged in and on auth pages, redirect
  if (session && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo) {
      console.log('🔀 Middleware: Logged in, redirecting to:', redirectTo)
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
    // ✅ Changed: default to home instead of dashboard.
    // Dashboard should only happen via explicit intent=creator flows,
    // which are handled upstream in login/signup pages via the `intent` param.
    console.log('🔀 Middleware: Logged in, no redirectTo — defaulting to home')
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ✅ ONLY check terms for upload route
  if (session && isCreatorRoute) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('terms_accepted, is_creator')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      console.error('❌ Profile error:', profileError)
      return response
    }

    // ✅ If trying to upload but not a creator, redirect to profile
    if (!profile?.is_creator) {
      console.log('🔀 Not a creator, redirecting to profile')
      return NextResponse.redirect(new URL('/profile', request.url))
    }

    // ✅ If creator but hasn't accepted terms, redirect to terms
    if (!profile?.terms_accepted) {
      console.log('🔀 Terms not accepted, redirecting to terms')
      return NextResponse.redirect(new URL('/terms', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
