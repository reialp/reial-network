import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create response early
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
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname

  // ✅ Define public routes (exact matches or prefixes)
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup',
    '/explore',
    '/film/',     // ← Added trailing slash to match /film/anything
    '/creator/',  // ← Added trailing slash to match /creator/anything
  ]
  
  const isPublic = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  )

  // ✅ Protected routes (exact matches or prefixes)
  const protectedRoutes = [
    '/dashboard',
    '/upload',
    '/library',
    '/profile',
    '/admin',
    '/checkout/',
    '/watch/',
  ]
  
  const isProtected = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  )

  // If protected and no session, redirect to login
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // If logged in and trying to access auth pages, redirect to dashboard
  if (session && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}