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
          
          {/* LOGO + BRAND – "Cheki." with yellow dot, film‑start on hover */}
          <Link href="/" className="flex items-center gap-1 sm:gap-2 flex-shrink-0 group">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10">
              <Image
                src="/logo.png"
                alt="Cheki"
                fill
                className="object-contain"
                sizes="(max-width: 640px) 32px, 40px"
                priority
              />
            </div>

            {/* "Cheki" with yellow dot – all animation on the whole text */}
            <span className="text-lg sm:text-xl font-bold leading-none text-white cheki-text">
              Cheki<span className="text-[#f5c518]">.</span>
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

      {/* CSS – only text animation, yellow dot stays yellow */}
      <style jsx>{`
        .cheki-text {
          transition: color 0.2s ease, text-shadow 0.2s ease;
        }

        .group:hover .cheki-text {
          animation: filmFlicker 1s ease-in-out forwards;
          color: #ffd700;
          text-shadow: 0 0 20px #ffd700, 0 0 40px #ffa500;
        }

        /* The yellow dot inherits the glow but keeps its color */
        .group:hover .cheki-text .text-\\[\\#f5c518\\] {
          color: #ffd700; /* it will glow together */
          text-shadow: inherit;
        }

        @keyframes filmFlicker {
          0% {
            opacity: 0.1;
            transform: scale(0.9) rotate(-1.5deg);
            color: #fff;
            text-shadow: none;
          }
          15% {
            opacity: 1;
            transform: scale(1.1) rotate(1deg);
            color: #ffd700;
            text-shadow: 0 0 30px #ffd700, 0 0 60px #ffa500;
          }
          30% {
            opacity: 0.3;
            transform: scale(0.95) rotate(0deg);
            color: #fff;
            text-shadow: none;
          }
          45% {
            opacity: 1;
            transform: scale(1.15) rotate(-1deg);
            color: #ffd700;
            text-shadow: 0 0 40px #ffd700, 0 0 80px #ffa500;
          }
          65% {
            opacity: 0.6;
            transform: scale(1.05) rotate(0.5deg);
            color: #ffd700;
            text-shadow: 0 0 20px #ffd700;
          }
          80% {
            opacity: 1;
            transform: scale(1.08) rotate(-0.5deg);
            color: #ffd700;
            text-shadow: 0 0 50px #ffd700, 0 0 100px #ffa500;
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
            color: #ffd700;
            text-shadow: 0 0 20px #ffd700, 0 0 40px #ffa500;
          }
        }
      `}</style>
    </nav>
  )
}
