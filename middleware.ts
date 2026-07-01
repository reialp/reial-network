import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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

  const { data: { session } } = await supabase.auth.getSession()
  const pathname = request.nextUrl.pathname

  // ✅ Public routes
  const isPublic =
    pathname === '/' ||
    pathname === '/auth/login' ||
    pathname === '/auth/signup' ||
    pathname === '/auth/callback' ||
    pathname === '/auth/reset-password' ||
    pathname === '/terms' ||
    pathname.startsWith('/explore') ||
    pathname.startsWith('/film/') ||
    pathname.startsWith('/creator/')

  // ✅ Protected routes
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/checkout/') ||
    pathname.startsWith('/watch/')

  // ✅ Creator-only routes
  const isCreatorRoute =
    pathname.startsWith('/upload')

  // If protected and no session
  if (isProtected && !session) {
    const redirectTo = encodeURIComponent(pathname + request.nextUrl.search)
    return NextResponse.redirect(new URL(`/auth/login?redirectTo=${redirectTo}`, request.url))
  }

  // If logged in and on auth pages
  if (session && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ✅ Check terms for upload route
  if (session && isCreatorRoute) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('terms_accepted, is_creator')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('❌ Profile error:', error)
      // If profile doesn't exist, redirect to profile to create it
      return NextResponse.redirect(new URL('/profile', request.url))
    }

    // If not a creator, redirect to profile
    if (!profile?.is_creator) {
      return NextResponse.redirect(new URL('/profile?intent=creator', request.url))
    }

    // If creator but hasn't accepted terms, redirect to terms
    if (!profile?.terms_accepted) {
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
