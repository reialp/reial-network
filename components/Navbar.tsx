'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSearch } from '@/context/SearchContext'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { searchTerm, setSearchTerm } = useSearch()

  const [user, setUser] = useState<any>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_creator, is_admin, terms_accepted')
          .eq('id', session.user.id)
          .single()
        if (profile) {
          setIsCreator(profile.is_creator || false)
          setIsAdmin(profile.is_admin || false)
          setHasAcceptedTerms(profile.terms_accepted || false)
        }
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_creator, is_admin, terms_accepted')
            .eq('id', session.user.id)
            .single()
          if (profile) {
            setIsCreator(profile.is_creator || false)
            setIsAdmin(profile.is_admin || false)
            setHasAcceptedTerms(profile.terms_accepted || false)
          }
          router.refresh()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsCreator(false)
          setIsAdmin(false)
          setHasAcceptedTerms(false)
          router.refresh()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // ✅ Handle upload click with terms and creator checks
  const handleUploadClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login?redirectTo=/upload')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('terms_accepted, is_creator')
      .eq('id', session.user.id)
      .single()

    // ✅ If not a creator, redirect to profile
    if (!profile?.is_creator) {
      router.push('/profile')
      return
    }

    // ✅ If creator but hasn't accepted terms
    if (!profile?.terms_accepted) {
      router.push('/terms')
      return
    }

    router.push('/upload')
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    ...(user ? [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '#', label: 'Upload', onClick: handleUploadClick },
      { href: '/library', label: 'Library' },
      { href: '/profile', label: 'Profile' },
      ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
    ] : [
      { href: '/auth/login', label: 'Sign In' },
      { href: '/auth/signup', label: 'Sign Up' },
    ]),
  ]

  return (
    <nav className="bg-[#0a0a0a] border-b border-white/10 sticky top-0 z-50 backdrop-blur-sm bg-black/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between py-3 gap-2">
          <Link href="/" className="text-xl font-bold flex items-center gap-2 flex-shrink-0">
            <span>Reial</span>
            <span className="text-[#f5c518]">.</span>
          </Link>

          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search films, creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm"
              />
              <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
            {navLinks.map((link) => (
              link.onClick ? (
                <button
                  key={link.href}
                  onClick={link.onClick}
                  className={`text-sm transition-colors hover:text-[#f5c518] ${
                    pathname === '/upload' ? 'text-[#f5c518] font-semibold' : 'text-gray-300'
                  }`}
                >
                  Upload
                </button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm transition-colors hover:text-[#f5c518] ${
                    pathname === link.href ? 'text-[#f5c518] font-semibold' : 'text-gray-300'
                  }`}
                >
                  {link.label}
                </Link>
              )
            ))}
            {user && (
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-red-400 transition-colors"
              >
                Logout
              </button>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => {
                const menu = document.getElementById('mobile-menu')
                if (menu) menu.classList.toggle('hidden')
              }}
              className="text-gray-400 hover:text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="md:hidden pb-3">
          <input
            type="text"
            placeholder="Search films, creators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm"
          />
        </div>

        <div id="mobile-menu" className="hidden md:hidden pb-4">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              link.onClick ? (
                <button
                  key={link.href}
                  onClick={(e) => {
                    link.onClick(e)
                    const menu = document.getElementById('mobile-menu')
                    if (menu) menu.classList.add('hidden')
                  }}
                  className="px-3 py-2 rounded-md text-sm transition-colors hover:bg-white/5 text-gray-300 text-left"
                >
                  Upload
                </button>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm transition-colors hover:bg-white/5 ${
                    pathname === link.href ? 'text-[#f5c518] bg-white/5' : 'text-gray-300'
                  }`}
                  onClick={() => {
                    const menu = document.getElementById('mobile-menu')
                    if (menu) menu.classList.add('hidden')
                  }}
                >
                  {link.label}
                </Link>
              )
            ))}
            {user && (
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 text-left transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
