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
    }, 6000)
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

  const renderFilmCard = (film: Film, isLarge: boolean = false) => {
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
        className={`group flex-shrink-0 bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.03] transition-all duration-500 hover:shadow-2xl hover:shadow-[#f5c518]/10 border border-white/5 hover:border-[#f5c518]/20 ${
          isLarge ? 'w-[160px] sm:w-[200px] md:w-[240px]' : 'w-[140px] sm:w-[180px] md:w-[220px]'
        }`}
      >
        <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
          {film.thumbnail_url ? (
            <Image
              src={film.thumbnail_url}
              alt={film.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl sm:text-6xl opacity-20">🎬</div>
          )}
          {film.category && (
            <div className="absolute top-2 right-2 bg-[#f5c518]/90 text-black text-[8px] sm:text-xs px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-semibold">
              {film.category}
            </div>
          )}
          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            {isPurchased ? (
              <span className="bg-green-500/90 text-white text-[8px] sm:text-sm font-bold px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full">✓ Owned</span>
            ) : (
              <span className="bg-black/80 text-[#f5c518] text-[8px] sm:text-sm font-bold px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full">KES {film.price}</span>
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
            <span className="text-gray-600 text-[8px] sm:text-xs">{isPurchased ? '▶ Watch' : '🎬'}</span>
          </div>
        </div>
      </Link>
    )
  }

  // Group films by category for rows
  const filmsByCategory = useMemo(() => {
    const grouped: Record<string, Film[]> = {}
    const all = filteredFilms
    
    if (selectedCategory === 'All' || !selectedCategory) {
      return { 'All Content': all }
    }
    
    all.forEach(film => {
      const cat = film.category || 'Uncategorized'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(film)
    })
    return grouped
  }, [filteredFilms, selectedCategory])

  // Featured films (first 5 for hero carousel)
  const featuredFilms = allFilms.slice(0, 5)

  // Top picks (next 8)
  const topPicks = allFilms.slice(5, 13)

  // Recently added (next 8)
  const recentFilms = allFilms.slice(13, 21)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading premium content...</p>
        </div>
      </div>
    )
  }

  const renderRow = (title: string, films: Film[], isLarge: boolean = false) => {
    if (films.length === 0) return null
    return (
      <div className="mb-6 sm:mb-8">
        <div className="flex justify-between items-center mb-3 sm:mb-4 px-4 sm:px-0">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold">{title}</h2>
          <Link href={`/explore?category=${title}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline">
            See All →
          </Link>
        </div>
        <div className="overflow-x-auto scrollbar-hide px-4 sm:px-0">
          <div className="flex gap-3 sm:gap-4 pb-4">
            {films.map(film => renderFilmCard(film, isLarge))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      
      {/* ✅ HERO SECTION - App Description + Buttons (Restored!) */}
      <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center px-4 sm:px-6 overflow-hidden bg-grid-pattern">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#1a0a0a] to-[#0a0a0a]">
          <div className="absolute top-1/4 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[#f5c518]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-[#f5c518]/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="text-center">
            <div className="inline-block px-3 sm:px-4 py-1.5 rounded-full bg-[#f5c518]/10 border border-[#f5c518]/20 text-[#f5c518] text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              Premium Content Marketplace
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] mb-4 sm:mb-6">
              Premium Stories.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f5c518] via-[#ffd700] to-[#f5c518]">
                Directly from Creators.
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-6 sm:mb-10 leading-relaxed">
              Discover and buy exclusive films, documentaries, series and more from amazing creators.
              <span className="block text-gray-500 text-xs sm:text-sm mt-2">Thousands of stories, one platform.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/explore"
                className="group bg-[#f5c518] text-black px-6 sm:px-8 py-3 sm:py-4 rounded-full font-semibold hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-[#f5c518]/25 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <span>Explore Content</span>
                <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <button
                onClick={handleBecomeCreatorClick}
                className="px-6 sm:px-8 py-3 sm:py-4 border border-white/20 rounded-full font-semibold hover:bg-white/10 transition-all duration-300 hover:scale-105 text-center cursor-pointer text-sm sm:text-base"
                type="button"
              >
                Become a Creator
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500 animate-bounce">
          <span className="text-[8px] sm:text-xs uppercase tracking-widest">Scroll</span>
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* CATEGORY FILTERS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 hover:scale-105 flex-shrink-0 ${
                selectedCategory === category
                  ? 'bg-[#f5c518] text-black shadow-lg shadow-[#f5c518]/25'
                  : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT ROWS - Streaming Style */}
      <div className="max-w-7xl mx-auto py-4 sm:py-6">
        {/* Top Picks */}
        {renderRow('Top Picks', topPicks)}
        
        {/* Recently Added */}
        {renderRow('Recently Added', recentFilms)}
        
        {/* Category-based rows */}
        {Object.entries(filmsByCategory).map(([category, films]) => {
          if (category === 'All Content') return null
          if (category === 'Featured' || category === 'Top Picks' || category === 'Recently Added') return null
          return renderRow(category, films)
        })}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-white/5 mt-4 sm:mt-8 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl font-bold">Reial<span className="text-[#f5c518]">.</span></span>
            <span className="text-gray-600 text-xs sm:text-sm">Premium Stories</span>
          </div>
          <div className="text-gray-500 text-xs sm:text-sm">© 2026 Reial Network. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
