'use client'

import { Suspense } from 'react'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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

function ExploreContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { searchTerm, setSearchTerm, selectedCategory, setSelectedCategory } = useSearch()

  const [allFilms, setAllFilms] = useState<Film[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())
  const scrollContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Sync URL search param with context
  useEffect(() => {
    const query = searchParams.get('search')
    if (query) {
      setSearchTerm(query)
    }
    const category = searchParams.get('category')
    if (category) {
      setSelectedCategory(category)
    }
  }, [searchParams, setSearchTerm, setSelectedCategory])

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
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
        const creatorIds = data.map(item => item.creator_id).filter(Boolean)
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
    fetchData()
  }, [supabase])

  useEffect(() => {
    async function fetchPurchases() {
      if (!userId) return
      const { data } = await supabase
        .from('purchases')
        .select('content_id')
        .eq('buyer_id', userId)
        .is('revoked_at', null)
      
      if (data) {
        const ids = new Set(data.map(p => p.content_id))
        setPurchasedIds(ids)
      }
    }
    fetchPurchases()
  }, [userId, supabase])

  const categories = ['All', ...new Set(allFilms.map(f => f.category).filter((c): c is string => c !== null))]

  const filteredFilms = useMemo(() => {
    let result = allFilms
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(f =>
        f.title.toLowerCase().includes(term) ||
        f.creator_name?.toLowerCase().includes(term)
      )
    }
    if (selectedCategory !== 'All') {
      result = result.filter(f => f.category === selectedCategory)
    }
    return result
  }, [allFilms, searchTerm, selectedCategory])

  // Group by category for streaming rows
  const groupedFilms = useMemo(() => {
    const grouped: Record<string, Film[]> = {}
    filteredFilms.forEach(film => {
      const cat = film.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(film)
    })
    return grouped
  }, [filteredFilms])

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
    const contentSlug = film.slug || film.id
    const categoryPath = film.category ? film.category.toLowerCase() : 'film'
    let watchUrl = `/${categoryPath}/${contentSlug}`
    if (isPurchased) {
      watchUrl = `/watch/${film.id}`
    }
    
    return (
      <Link
        key={film.id}
        href={watchUrl}
        className="group flex-shrink-0 w-[140px] sm:w-[180px] md:w-[200px] lg:w-[220px] bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.05] transition-all duration-300 hover:shadow-xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
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
        </div>
      </Link>
    )
  }

  const renderRow = (title: string, films: Film[], rowId: string) => {
    if (films.length === 0) return null
    return (
      <div className="mb-6 sm:mb-10 px-4 sm:px-6 md:px-8 lg:px-10 group/row">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">
            {title}
          </h2>
          <Link href={`/explore?category=${encodeURIComponent(title)}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline font-medium">
            See All →
          </Link>
        </div>
        <div className="relative">
          <button
            onClick={() => scrollRow('left', rowId)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-1.5 sm:p-2 rounded-full transition-all duration-300 opacity-0 group-hover/row:opacity-100 hover:scale-110 hidden sm:flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => scrollRow('right', rowId)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 text-white p-1.5 sm:p-2 rounded-full transition-all duration-300 opacity-0 group-hover/row:opacity-100 hover:scale-110 hidden sm:flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div
            ref={(el) => { scrollContainerRefs.current[rowId] = el }}
            className="overflow-x-auto scrollbar-hide pb-3 sm:pb-4 scroll-smooth -mx-4 sm:mx-0 px-4 sm:px-0"
          >
            <div className="flex gap-2.5 sm:gap-3 md:gap-4">
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Loading content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Explore</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            {filteredFilms.length} {filteredFilms.length === 1 ? 'film' : 'films'} available
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
      </div>

      {/* Search + Categories */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/5 py-2 sm:py-3 px-4 sm:px-6 md:px-8 lg:px-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative w-full sm:flex-1">
            <input
              type="text"
              placeholder="Search films, creators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 sm:px-4 py-1.5 sm:py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-xs sm:text-sm"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
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

      {filteredFilms.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
          <div className="bg-[#1a1a1a] rounded-2xl p-8 sm:p-12 md:p-16 text-center border border-white/5">
            <div className="text-5xl sm:text-6xl mb-4">🎬</div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">
              {searchTerm || selectedCategory !== 'All' ? 'No matching content' : 'No content found'}
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
              {searchTerm || selectedCategory !== 'All' 
                ? `Try adjusting your filters or search term.` 
                : 'Check back soon for new content from creators.'}
            </p>
            {(searchTerm || selectedCategory !== 'All') && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('All')
                }}
                className="inline-block mt-4 sm:mt-6 bg-[#f5c518] text-black px-5 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full font-semibold hover:scale-105 transition-all duration-300 text-sm sm:text-base"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto py-3 sm:py-4 md:py-6">
          
          {/* Streaming Rows */}
          {Object.entries(groupedFilms).map(([category, films]) => {
            if (category === 'Other' && films.length < 3) return null
            return renderRow(category, films, `category-${category}`)
          })}

          {/* All Films - Grid view */}
          <div className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-6 md:pt-8 border-t border-white/5 px-4 sm:px-6 md:px-8 lg:px-10">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg md:text-xl font-bold">All Content</h2>
              <span className="text-gray-500 text-xs sm:text-sm">{filteredFilms.length} films</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
              {filteredFilms.map((film) => {
                const isPurchased = purchasedIds.has(film.id)
                const contentSlug = film.slug || film.id
                const categoryPath = film.category ? film.category.toLowerCase() : 'film'
                let watchUrl = `/${categoryPath}/${contentSlug}`
                if (isPurchased) {
                  watchUrl = `/watch/${film.id}`
                }
                
                return (
                  <Link
                    key={film.id}
                    href={watchUrl}
                    className="group bg-[#1a1a1a] rounded-lg sm:rounded-xl overflow-hidden hover:scale-[1.03] transition-all duration-300 hover:shadow-lg hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
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
                        <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl opacity-20">🎬</div>
                      )}
                      {film.category && (
                        <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-[#f5c518]/90 text-black text-[6px] sm:text-[8px] px-1 sm:px-2 py-0.5 rounded-full font-semibold">
                          {film.category}
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {isPurchased ? (
                          <span className="bg-green-500 text-white text-[6px] sm:text-[8px] font-bold px-1 sm:px-2 py-0.5 rounded-full">✓ Owned</span>
                        ) : (
                          <span className="bg-black/80 text-[#f5c518] text-[6px] sm:text-[8px] font-bold px-1 sm:px-2 py-0.5 rounded-full">KES {film.price}</span>
                        )}
                      </div>
                    </div>
                    <div className="p-1.5 sm:p-2 md:p-3">
                      <h3 className="font-semibold text-[10px] sm:text-xs md:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
                        {film.title}
                      </h3>
                      <p className="text-gray-500 text-[6px] sm:text-[8px] md:text-xs mt-0.5 truncate">
                        {film.creator_name || 'Unknown Creator'}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Loading...</p>
        </div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  )
}
