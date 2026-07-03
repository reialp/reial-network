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
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())
  const [purchaseTokens, setPurchaseTokens] = useState<Record<string, string>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const scrollContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

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

  useEffect(() => {
    if (allFilms.length === 0) return
    intervalRef.current = setInterval(() => {
      if (!isPaused) {
        setCarouselIndex((prev) => (prev + 1) % allFilms.length)
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

  const carouselFilms = allFilms.slice(0, 5)

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

  const scrollRow = (direction: 'left' | 'right', rowId: string) => {
    const container = scrollContainerRefs.current[rowId]
    if (!container) return
    const scrollAmount = container.clientWidth * 0.8
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

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
        className="group flex-shrink-0 w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px] bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.05] transition-all duration-300 hover:shadow-xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
      >
        <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
          {film.thumbnail_url ? (
            <Image
              src={film.thumbnail_url}
              alt={film.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🎬</div>
          )}
          {film.category && (
            <div className="absolute top-2 right-2 bg-[#f5c518]/90 text-black text-[8px] sm:text-xs px-1.5 sm:px-3 py-0.5 rounded-full font-semibold">
              {film.category}
            </div>
          )}
          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {isPurchased ? (
              <span className="bg-green-500 text-white text-[8px] sm:text-xs font-bold px-2 py-0.5 rounded-full">✓ Owned</span>
            ) : (
              <span className="bg-black/80 text-[#f5c518] text-[8px] sm:text-xs font-bold px-2 py-0.5 rounded-full">KES {film.price}</span>
            )}
          </div>
        </div>
        <div className="p-2 sm:p-3">
          <h3 className="font-semibold text-xs sm:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
            {film.title}
          </h3>
          <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5 truncate">
            {film.creator_name || 'Unknown Creator'}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            {isPurchased ? (
              <span className="text-green-400 font-bold text-[8px] sm:text-xs">✓ Purchased</span>
            ) : (
              <span className="text-[#f5c518] font-bold text-[8px] sm:text-xs">KES {film.price}</span>
            )}
            <span className="text-gray-600 text-[8px] sm:text-xs">{isPurchased ? '▶' : '🎬'}</span>
          </div>
        </div>
      </Link>
    )
  }

  const renderRow = (title: string, films: Film[], rowId: string) => {
    if (films.length === 0) return null
    return (
      <div className="mb-6 sm:mb-10 group/row">
        <div className="flex justify-between items-center mb-3 sm:mb-4 px-4 sm:px-0">
          <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white">
            {title}
          </h2>
          <Link href={`/explore?category=${title}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline font-medium">
            See All →
          </Link>
        </div>
        <div className="relative">
          <button
            onClick={() => scrollRow('left', rowId)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-opacity opacity-0 group-hover/row:opacity-100 hover:scale-110 hidden md:flex items-center justify-center w-10 h-10"
            aria-label="Scroll left"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => scrollRow('right', rowId)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-opacity opacity-0 group-hover/row:opacity-100 hover:scale-110 hidden md:flex items-center justify-center w-10 h-10"
            aria-label="Scroll right"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none hidden md:block" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none hidden md:block" />

          <div
            ref={(el) => { scrollContainerRefs.current[rowId] = el }}
            className="overflow-x-auto scrollbar-hide px-4 sm:px-0 pb-4 -mx-4 sm:mx-0 scroll-smooth"
          >
            <div className="flex gap-3 sm:gap-4 md:gap-5 px-4 sm:px-0">
              {films.map(film => renderFilmCard(film))}
            </div>
          </div>

          <div className="flex justify-center mt-1 sm:hidden">
            <span className="text-[8px] text-gray-600 animate-pulse">← Swipe to browse →</span>
          </div>
        </div>
      </div>
    )
  }

  const featuredFilms = allFilms.slice(0, 8)
  const topPicks = allFilms.slice(8, 16)
  const recentFilms = allFilms.slice(16, 24)

  const categoryRows = useMemo(() => {
    const grouped: Record<string, Film[]> = {}
    allFilms.forEach(film => {
      const cat = film.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(film)
    })
    return grouped
  }, [allFilms])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading premium content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      
      {/* ✅ HERO SECTION - Fixed for mobile */}
      <section className="relative h-[70vh] sm:h-[80vh] md:h-[85vh] lg:h-[90vh] w-full overflow-hidden">
        {/* Carousel Background */}
        <div className="absolute inset-0">
          {carouselFilms.map((film, idx) => (
            <div
              key={film.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === carouselIndex ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {film.thumbnail_url ? (
                <>
                  <Image
                    src={film.thumbnail_url}
                    alt={film.title}
                    fill
                    className="object-cover"
                    priority={idx === 0}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-6xl bg-[#1a1a1a]">🎬</div>
              )}
            </div>
          ))}
          
          {/* Carousel dots - moved up for mobile */}
          <div className="absolute bottom-20 sm:bottom-24 md:bottom-32 left-4 sm:left-8 md:left-16 flex gap-2 z-20">
            {carouselFilms.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCarouselIndex(idx)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  idx === carouselIndex ? 'bg-[#f5c518] w-8' : 'bg-white/40 w-4 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ✅ Hero Content - Better mobile positioning */}
        <div className="relative z-10 h-full flex flex-col justify-between">
          {/* Top - Logo (smaller on mobile) */}
          <div className="pt-4 sm:pt-6 md:pt-8 px-4 sm:px-8 md:px-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-lg sm:text-xl md:text-2xl font-bold">Reial<span className="text-[#f5c518]">.</span></span>
              <span className="text-gray-400 text-[10px] sm:text-xs md:text-sm hidden xs:inline">Premium Stories</span>
            </div>
          </div>

          {/* Center - Featured content (centered better on mobile) */}
          <div className="flex-1 flex items-center px-4 sm:px-8 md:px-16 pb-4 sm:pb-8">
            <div className="max-w-2xl w-full">
              <div className="inline-block px-2 sm:px-3 md:px-4 py-0.5 sm:py-1 md:py-1.5 rounded-full bg-[#f5c518]/20 border border-[#f5c518]/30 text-[#f5c518] text-[10px] sm:text-xs md:text-sm font-medium mb-2 sm:mb-3 md:mb-4">
                {carouselFilms[carouselIndex]?.category || 'Featured'}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.1] mb-1 sm:mb-2 line-clamp-2">
                {carouselFilms[carouselIndex]?.title || 'Premium Stories'}
              </h1>
              <p className="text-gray-300 text-xs sm:text-sm md:text-base mb-2 sm:mb-3 md:mb-4">
                {carouselFilms[carouselIndex]?.creator_name || 'Unknown Creator'}
              </p>
              
              {/* Action buttons - stacked on mobile, row on larger screens */}
              <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4">
                <Link
                  href={`/${carouselFilms[carouselIndex]?.category?.toLowerCase() || 'film'}/${carouselFilms[carouselIndex]?.slug || carouselFilms[carouselIndex]?.id}`}
                  className="bg-[#f5c518] text-black px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-full font-semibold hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-[#f5c518]/25 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base"
                >
                  <span>▶ Watch Now</span>
                </Link>
                <Link
                  href="/explore"
                  className="border border-white/30 text-white px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 md:py-2.5 rounded-full font-semibold hover:bg-white/10 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base"
                >
                  <span>Explore All</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom - App description + Become a Creator (better mobile layout) */}
          <div className="pb-3 sm:pb-4 md:pb-6 px-4 sm:px-8 md:px-16 z-20">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3 md:gap-4">
              <p className="text-gray-400 text-[10px] sm:text-xs md:text-sm text-center sm:text-left">
                Discover and buy exclusive films, documentaries, series and more from amazing creators.
              </p>
              <button
                onClick={handleBecomeCreatorClick}
                className="bg-[#f5c518]/10 hover:bg-[#f5c518]/20 border border-[#f5c518]/30 text-[#f5c518] px-3 sm:px-4 md:px-6 py-1 sm:py-1.5 md:py-2 rounded-full text-[10px] sm:text-xs md:text-sm font-semibold transition-all duration-300 hover:scale-105 whitespace-nowrap"
              >
                Become a Creator
              </button>
            </div>
          </div>
        </div>

        {/* Scroll indicator - smaller on mobile */}
        <div className="absolute bottom-1 sm:bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 sm:gap-1 text-gray-500 animate-bounce z-10">
          <span className="text-[5px] sm:text-[6px] md:text-[8px] uppercase tracking-widest">Scroll</span>
          <svg className="w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* CATEGORY FILTERS */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5 py-2 sm:py-3 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
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

      {/* CONTENT ROWS */}
      <div className="max-w-7xl mx-auto py-3 sm:py-4 md:py-6">
        {renderRow('Featured', featuredFilms, 'featured')}
        {renderRow('Top Picks', topPicks, 'top-picks')}
        {renderRow('Recently Added', recentFilms, 'recently-added')}
        
        {Object.entries(categoryRows).map(([category, films]) => {
          if (category === 'Featured' || category === 'Top Picks' || category === 'Recently Added') return null
          return renderRow(category, films, `category-${category}`)
        })}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/5 mt-4 sm:mt-8 px-4 sm:px-6 py-6 sm:py-8 md:py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 md:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-lg sm:text-xl md:text-2xl font-bold">Reial<span className="text-[#f5c518]">.</span></span>
            <span className="text-gray-600 text-[10px] sm:text-xs md:text-sm">Premium Stories</span>
          </div>
          <div className="text-gray-500 text-[10px] sm:text-xs md:text-sm">© 2026 Reial Network. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
