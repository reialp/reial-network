'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSearch } from '@/context/SearchContext'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { searchTerm, setSearchTerm } = useSearch()
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState<any>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)

  const loadUser = async () => {
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
    } else {
      setUser(null)
      setIsCreator(false)
      setIsAdmin(false)
      setHasAcceptedTerms(false)
    }
  }

  useEffect(() => {
    loadUser()

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
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsCreator(false)
          setIsAdmin(false)
          setHasAcceptedTerms(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (searchTerm && searchTerm.length > 0) {
      setTimeout(() => {
        const resultsContainer = document.getElementById('search-results')
        if (resultsContainer) {
          resultsContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          })
        } else {
          window.scrollTo({
            top: window.innerHeight * 0.6,
            behavior: 'smooth'
          })
        }
      }, 100)
    }
  }, [searchTerm])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleUploadClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login?redirectTo=/upload')
      return
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('terms_accepted, is_creator')
      .eq('id', session.user.id)
      .single()

    if (error || !profile) {
      router.push('/profile')
      return
    }

    if (!profile.is_creator) {
      router.push('/profile?intent=creator')
      return
    }

    if (!profile.terms_accepted) {
      router.push('/terms')
      return
    }

    router.push('/upload')
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    ...(user ? [
      { href: '/dashboard', label: 'Dashboard' },
      ...(isCreator ? [{ href: '/upload', label: 'Upload', onClick: handleUploadClick }] : []),
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
          
          {/* LOGO + BRAND – FILM START HOVER EFFECT */}
          <Link href="/" className="flex items-center gap-1 sm:gap-2 flex-shrink-0 group relative">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 group-hover:animate-pulse transition-all duration-200">
              <Image
                src="/logo.png"
                alt="Cheki"
                fill
                className="object-contain"
                sizes="(max-width: 640px) 32px, 40px"
                priority
              />
            </div>

            {/* Brand name with cinema spotlight + flicker on hover */}
            <span className="text-lg sm:text-xl font-bold leading-none text-white relative transition-all duration-150 group-hover:text-[#f5c518] group-hover:scale-105 group-hover:drop-shadow-[0_0_15px_rgba(245,197,24,0.6)]">
              Cheki

              {/* Spinning film reel – appears on hover */}
              <span className="absolute -right-6 sm:-right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:animate-spin text-[#f5c518] text-sm sm:text-base transition-opacity duration-200 pointer-events-none">
                🎞️
              </span>

              {/* Flicker overlay – only runs on hover */}
              <span className="absolute inset-0 pointer-events-none mix-blend-overlay rounded-sm film-flicker"></span>
            </span>
          </Link>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search films, creators..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm"
              />
              <svg className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
            {navLinks.map((link) => (
              link.onClick ? (
                <button
                  key={link.label}
                  onClick={link.onClick}
                  className={`text-sm transition-colors hover:text-[#f5c518] ${
                    pathname === link.href ? 'text-[#f5c518] font-semibold' : 'text-gray-300'
                  }`}
                >
                  {link.label}
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

          {/* Mobile Menu Button */}
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

        {/* Mobile Search */}
        <div className="md:hidden pb-3">
          <input
            type="text"
            placeholder="Search films, creators..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm"
          />
        </div>

        {/* Mobile Menu */}
        <div id="mobile-menu" className="hidden md:hidden pb-4">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              link.onClick ? (
                <button
                  key={link.label}
                  onClick={(e) => {
                    link.onClick(e)
                    const menu = document.getElementById('mobile-menu')
                    if (menu) menu.classList.add('hidden')
                  }}
                  className={`px-3 py-2 rounded-md text-sm transition-colors hover:bg-white/5 text-left ${
                    pathname === link.href ? 'text-[#f5c518] bg-white/5' : 'text-gray-300'
                  }`}
                >
                  {link.label}
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

      {/* CSS for the film flicker effect */}
      <style jsx>{`
        .film-flicker {
          animation: none;
        }

        .group:hover .film-flicker {
          animation: filmStart 0.6s ease-in-out forwards;
        }

        @keyframes filmStart {
          0% {
            opacity: 0;
            background: rgba(245, 197, 24, 0);
          }
          10% {
            opacity: 0.2;
            background: rgba(245, 197, 24, 0.15);
            transform: scale(1.02);
          }
          20% {
            opacity: 0;
            background: rgba(245, 197, 24, 0);
          }
          30% {
            opacity: 0.15;
            background: rgba(245, 197, 24, 0.1);
            transform: scale(1.01);
          }
          45% {
            opacity: 0;
            background: rgba(245, 197, 24, 0);
          }
          60% {
            opacity: 0.25;
            background: rgba(245, 197, 24, 0.2);
            transform: scale(1.03);
          }
          80% {
            opacity: 0.05;
            background: rgba(245, 197, 24, 0.05);
          }
          100% {
            opacity: 0;
            background: rgba(245, 197, 24, 0);
            transform: scale(1);
          }
        }
      `}</style>
    </nav>
  )
}
