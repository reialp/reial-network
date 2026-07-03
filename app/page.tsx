'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSearch } from '@/context/SearchContext'

interface Film {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  category: string | null
  price: number
  created_at: string
  purchase_count: number
  views: number
  creator_name: string | null
  slug: string | null
}

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const { searchTerm, selectedCategory, setSelectedCategory } = useSearch()

  const [allFilms, setAllFilms] = useState<Film[]>([])
  const [loading, setLoading] = useState(true)
  const [heroIndex, setHeroIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())
  const [purchaseTokens, setPurchaseTokens] = useState<Record<string, string>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          window.location.reload()
        }
      }
    )
    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    async function fetchFilms() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
        setSession(session)
      }

      const { data, error } = await supabase
        .from('content')
        .select(`
          id,
          title,
          description,
          thumbnail_url,
          category,
          price,
          created_at,
          purchase_count,
          views,
          creator_id,
          slug
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      if (!error && data) {
        const creatorIds = data.map((item: any) => item.creator_id).filter(Boolean)
        let creatorNames: Record<string, string> = {}
        
        if (creatorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', creatorIds)
          
          if (profilesData) {
            creatorNames = profilesData.reduce((acc, p) => {
              acc[p.id] = p.full_name || 'Unknown Creator'
              return acc
            }, {} as Record<string, string>)
          }
        }

        const mappedData = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          thumbnail_url: item.thumbnail_url,
          category: item.category,
          price: item.price,
          created_at: item.created_at,
          purchase_count: item.purchase_count || 0,
          views: item.views || 0,
          creator_name: creatorNames[item.creator_id] || 'Unknown Creator',
          slug: item.slug || null
        }))
        setAllFilms(mappedData)
      }
      setLoading(false)
    }
    fetchFilms()
  }, [supabase])

  useEffect(() => {
    async function fetchPurchases() {
      if (!userId) return
      
      const { data, error } = await supabase
        .from('purchases')
        .select('content_id, watch_token')
        .eq('buyer_id', userId)
        .is('revoked_at', null)
      
      if (error) {
        console.error('Error fetching purchases:', error)
        return
      }
      
      if (data) {
        const ids = new Set(data.map(p => p.content_id))
        setPurchasedIds(ids)
        
        const tokens: Record<string, string> = {}
        data.forEach(p => {
          tokens[p.content_id] = p.watch_token
        })
        setPurchaseTokens(tokens)
      }
    }
    fetchPurchases()
  }, [userId, supabase])

  // Auto-play hero carousel
  useEffect(() => {
    if (allFilms.length === 0) return
    intervalRef.current = setInterval(() => {
      if (!isPaused) {
        setHeroIndex((prev) => (prev + 1) % allFilms.length)
      }
    }, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [allFilms, isPaused])

  const categories = ['All', ...new Set(allFilms.map(f => f.category).filter((c): c is string => c !== null))]

  const filteredFilms = useMemo(() => {
    let result = allFilms
    if (selectedCategory !== 'All') {
      result = result.filter(f => f.category === selectedCategory)
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(f =>
        f.title.toLowerCase().includes(term) ||
        f.creator_name?.toLowerCase().includes(term)
      )
    }
    return result
  }, [allFilms, selectedCategory, searchTerm])

  const handleBecomeCreatorClick = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/auth/signup?intent=creator'
        return
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_creator, terms_accepted')
        .eq('id', session.user.id)
        .single()
      if (error || !profile) {
        window.location.href = '/profile?intent=creator'
        return
      }
      if (profile.is_creator) {
        if (profile.terms_accepted) {
          window.location.href = '/upload'
        } else {
          window.location.href = '/terms'
        }
        return
      }
      window.location.href = '/profile?intent=creator'
    } catch (err) {
      console.error('Error:', err)
    }
  }

  // ✅ RENDER FILM CARD - Clean, Netflix-style
  const renderFilmCard = (film: Film) => {
    const isPurchased = purchasedIds.has(film.id)
    const token = purchaseTokens[film.id]
    
    const contentSlug = film.slug || film.id
    const categoryPath = film.category ? film.category.toLowerCase() : 'film'
    let watchUrl = `/${categoryPath}/${contentSlug}`
    if (isPurchased && token) {
      watchUrl = `/watch/${token}`
    } else if (isPurchased && !token) {
      watchUrl = `/watch/${film.id}`
    }
    
    return (
      <Link
        key={film.id}
        href={watchUrl}
        className="group flex-shrink-0 w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px] rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:z-10"
      >
        <div className="relative aspect-[2/3] bg-[#1a1a1a] rounded-lg overflow-hidden">
          {film.thumbnail_url ? (
            <Image
              src={film.thumbnail_url}
              alt={film.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20 bg-[#2a2a2a]">🎬</div>
          )}
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {film.category && (
            <div className="absolute top-2 right-2 bg-[#f5c518]/90 text-black text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded">
              {film.category}
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {isPurchased ? (
              <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Owned</span>
            ) : (
              <span className="bg-[#f5c518] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">KES {film.price}</span>
            )}
          </div>
        </div>
        <div className="p-2">
          <h3 className="text-xs sm:text-sm font-semibold truncate group-hover:text-[#f5c518] transition-colors">
            {film.title}
          </h3>
          <p className="text-gray-500 text-[10px] sm:text-xs truncate">
            {film.creator_name || 'Unknown Creator'}
          </p>
        </div>
      </Link>
    )
  }

  // ✅ RENDER ROW - Netflix-style horizontal scroll
  const renderRow = (title: string, films: Film[]) => {
    if (films.length === 0) return null
    return (
      <div className="mb-6 sm:mb-8">
        <div className="flex justify-between items-center px-4 sm:px-0 mb-2 sm:mb-3">
          <h2 className="text-base sm:text-lg md:text-xl font-bold">{title}</h2>
          <Link href={`/explore?category=${title}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline">
            See All →
          </Link>
        </div>
        <div className="relative">
          <div className="overflow-x-auto scrollbar-hide px-4 sm:px-0 pb-4">
            <div className="flex gap-3 sm:gap-4">
              {films.map(film => renderFilmCard(film))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ✅ RENDER HERO SLIDE - Full-width featured content
  const renderHeroSlide = (film: Film) => {
    const isPurchased = purchasedIds.has(film.id)
    const token = purchaseTokens[film.id]
    
    const contentSlug = film.slug || film.id
    const categoryPath = film.category ? film.category.toLowerCase() : 'film'
    let watchUrl = `/${categoryPath}/${contentSlug}`
    if (isPurchased && token) {
      watchUrl = `/watch/${token}`
    } else if (isPurchased && !token) {
      watchUrl = `/watch/${film.id}`
    }
    
    return (
      <Link href={watchUrl} className="relative w-full h-full flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10" />
        
        {film.thumbnail_url ? (
          <Image
            src={film.thumbnail_url}
            alt={film.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-6xl bg-[#1a1a1a]">🎬</div>
        )}
        
        <div className="relative z-20 h-full flex items-center px-6 sm:px-10 md:px-16">
          <div className="max-w-lg">
            <div className="inline-block px-3 py-1 bg-[#f5c518]/20 border border-[#f5c518]/30 text-[#f5c518] text-xs rounded-full mb-3">
              {film.category || 'Featured'}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-2 line-clamp-2">
              {film.title}
            </h1>
            <p className="text-gray-300 text-sm sm:text-base mb-4 line-clamp-2 max-w-md">
              {film.creator_name || 'Unknown Creator'}
            </p>
            <div className="flex items-center gap-3">
              {isPurchased ? (
                <>
                  <span className="bg-green-500 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-full">
                    ✓ Owned
                  </span>
                  <span className="bg-white/20 backdrop-blur text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full hover:bg-white/30 transition">
                    ▶ Watch Now
                  </span>
                </>
              ) : (
                <>
                  <span className="bg-[#f5c518] text-black text-xs sm:text-sm font-bold px-4 py-2 rounded-full">
                    KES {film.price}
                  </span>
                  <span className="bg-white/20 backdrop-blur text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full hover:bg-white/30 transition">
                    View Details →
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // Prepare content rows
  const heroFilms = allFilms.slice(0, 6)
  const continueWatching = allFilms.slice(6, 14)
  const popular = allFilms.slice(14, 22)
  const newReleases = allFilms.slice(22, 30)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      
      {/* ✅ HERO CAROUSEL - Full width, auto-playing */}
      <section className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] w-full overflow-hidden">
        <div 
          className="relative h-full w-full flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${heroIndex * 100}%)` }}
        >
          {heroFilms.map(film => renderHeroSlide(film))}
        </div>
        
        {/* Hero dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {heroFilms.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setHeroIndex(idx)}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === heroIndex ? 'bg-[#f5c518] w-8' : 'bg-white/30 w-4 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
        
        {/* Navigation arrows */}
        <button
          onClick={() => setHeroIndex((prev) => (prev - 1 + heroFilms.length) % heroFilms.length)}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition hidden md:flex items-center justify-center w-10 h-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setHeroIndex((prev) => (prev + 1) % heroFilms.length)}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition hidden md:flex items-center justify-center w-10 h-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* ✅ CATEGORY FILTERS - Quick navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-sm border-b border-white/5 py-3 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                  selectedCategory === category
                    ? 'bg-[#f5c518] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ✅ CONTENT ROWS - Netflix-style scrolling rows */}
      <div className="max-w-7xl mx-auto py-4 sm:py-6">
        {continueWatching.length > 0 && renderRow('Continue Watching', continueWatching)}
        {popular.length > 0 && renderRow('Popular Now', popular)}
        {newReleases.length > 0 && renderRow('New Releases', newReleases)}
        
        {/* Category-based rows */}
        {Object.entries(
          allFilms.reduce((acc: Record<string, Film[]>, film) => {
            const cat = film.category || 'Other'
            if (!acc[cat]) acc[cat] = []
            acc[cat].push(film)
            return acc
          }, {})
        ).map(([category, films]) => {
          // Skip categories already shown
          const skipCategories = ['Continue Watching', 'Popular Now', 'New Releases']
          if (skipCategories.includes(category)) return null
          return renderRow(category, films)
        })}
      </div>

      {/* ✅ BECOME A CREATOR SECTION - Promo */}
      {!session && (
        <section className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
          <div className="bg-gradient-to-r from-[#f5c518]/10 to-[#f5c518]/5 border border-[#f5c518]/20 rounded-2xl p-6 sm:p-10 text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Share Your Story</h2>
            <p className="text-gray-400 text-sm sm:text-base mb-4">
              Become a creator and start earning from your content today.
            </p>
            <button
              onClick={handleBecomeCreatorClick}
              className="bg-[#f5c518] text-black px-6 py-2 rounded-full font-semibold hover:scale-105 transition"
            >
              Become a Creator
            </button>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/5 px-4 py-8 sm:py-12 mt-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">Reial<span className="text-[#f5c518]">.</span></span>
            <span className="text-gray-600 text-sm">Premium Stories</span>
          </div>
          <div className="text-gray-500 text-sm">© 2026 Reial Network. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
