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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
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

  const renderFilmCard = (film: Film, isLarge: boolean = false) => {
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
        className={`group flex-shrink-0 ${
          isLarge 
            ? 'w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]' 
            : 'w-[140px] sm:w-[180px] md:w-[200px] lg:w-[220px]'
        } bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] rounded-xl overflow-hidden hover:scale-[1.05] transition-all duration-500 hover:shadow-2xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/40 group relative`}
      >
        <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
          {film.thumbnail_url ? (
            <>
              <Image
                src={film.thumbnail_url}
                alt={film.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]">🎬</div>
          )}
          
          {/* Category badge */}
          {film.category && (
            <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-[#f5c518]/90 backdrop-blur-sm text-black text-[8px] sm:text-[10px] font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg">
              {film.category}
            </div>
          )}
          
          {/* Price/Owned badge */}
          <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
            {isPurchased ? (
              <span className="bg-green-500 text-white text-[8px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Owned
              </span>
            ) : (
              <span className="bg-gradient-to-r from-[#f5c518] to-[#ffd700] text-black text-[8px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg">
                KES {film.price}
              </span>
            )}
          </div>

          {/* Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#f5c518]/90 backdrop-blur-sm flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-500 shadow-2xl">
              <svg className="w-5 h-5 sm:w-7 sm:h-7 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="p-2.5 sm:p-4">
          <h3 className="font-semibold text-xs sm:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
            {film.title}
          </h3>
          <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5 truncate flex items-center gap-1">
            <svg className="w-3 h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            {film.creator_name || 'Unknown Creator'}
          </p>
          <div className="flex items-center gap-3 mt-1.5 text-[8px] sm:text-[10px] text-gray-600">
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              {film.views || 0}
            </span>
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                <path fillRule="evenodd" d="M10 4a1 1 0 011 1v5h4a1 1 0 110 2h-5a1 1 0 01-1-1V5a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {film.purchase_count || 0} sales
            </span>
          </div>
        </div>
      </Link>
    )
  }

  const renderRow = (title: string, films: Film[], rowId: string) => {
    if (films.length === 0) return null
    return (
      <div className="mb-8 sm:mb-12 px-4 sm:px-6 md:px-8 lg:px-10 group/row">
        <div className="flex justify-between items-center mb-4 sm:mb-5">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            {title}
            <span className="text-xs text-gray-500 font-normal bg-white/5 px-2 py-0.5 rounded-full">
              {films.length}
            </span>
          </h2>
          <Link href={`/explore?category=${encodeURIComponent(title)}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            See All
            <svg className="w-3 h-3 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="relative">
          <button
            onClick={() => scrollRow('left', rowId)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-black text-white p-2 sm:p-3 rounded-full transition-all duration-300 opacity-0 group-hover/row:opacity-100 hover:scale-110 hidden sm:flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shadow-2xl backdrop-blur-sm border border-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => scrollRow('right', rowId)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-black text-white p-2 sm:p-3 rounded-full transition-all duration-300 opacity-0 group-hover/row:opacity-100 hover:scale-110 hidden sm:flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shadow-2xl backdrop-blur-sm border border-white/10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div
            ref={(el) => { scrollContainerRefs.current[rowId] = el }}
            className="overflow-x-auto scrollbar-hide pb-4 scroll-smooth -mx-4 sm:mx-0 px-4 sm:px-0"
          >
            <div className="flex gap-3 sm:gap-4 md:gap-5">
              {films.map(film => renderFilmCard(film, false))}
            </div>
          </div>

          <div className="flex justify-center mt-2 sm:hidden">
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
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#f5c518]/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm mt-4 animate-pulse">Loading content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] text-white">
      {/* Header - Enhanced */}
      <div className="relative border-b border-white/5 px-6 sm:px-10 md:px-16 lg:px-20 py-6 sm:py-8 md:py-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#f5c518]/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Explore
              </h1>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                <span className="bg-[#f5c518]/10 px-2 py-0.5 rounded-full text-[#f5c518] text-xs font-semibold">
                  {filteredFilms.length}
                </span>
                {filteredFilms.length === 1 ? 'film' : 'films'} available
                {searchTerm && (
                  <span className="text-gray-500">
                    matching <span className="text-white">"{searchTerm}"</span>
                  </span>
                )}
              </p>
            </div>
            
            {/* View toggle */}
            <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-1 border border-white/5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all duration-300 ${
                  viewMode === 'grid' 
                    ? 'bg-[#f5c518] text-black' 
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm8-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all duration-300 ${
                  viewMode === 'list' 
                    ? 'bg-[#f5c518] text-black' 
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search + Categories - Enhanced */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 py-3 sm:py-4 px-6 sm:px-10 md:px-16 lg:px-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="relative w-full md:flex-1">
            <input
              type="text"
              placeholder="Search films, creators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518]/50 focus:border-[#f5c518] outline-none text-white placeholder-gray-500 text-sm transition-all duration-300"
            />
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide py-1">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                  selectedCategory === category
                    ? 'bg-[#f5c518] text-black shadow-lg shadow-[#f5c518]/20'
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
        <div className="max-w-7xl mx-auto px-6 sm:px-10 md:px-16 lg:px-20 py-16 sm:py-20 md:py-28">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-3xl p-12 sm:p-16 md:p-20 text-center border border-white/5">
            <div className="text-6xl sm:text-7xl mb-6 opacity-50">🎬</div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3">
              {searchTerm || selectedCategory !== 'All' ? 'No matching content' : 'No content found'}
            </h2>
            <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
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
                className="inline-block mt-6 bg-[#f5c518] text-black px-8 py-3 rounded-full font-semibold hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-[#f5c518]/25 text-sm md:text-base"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto py-4 sm:py-6 md:py-8">
          
          {/* STREAMING ROWS - Grouped by category */}
          {Object.entries(groupedFilms).map(([category, films]) => {
            if (category === 'Other' && films.length < 3) return null
            return renderRow(category, films, `category-${category}`)
          })}

          {/* ALL FILMS - Grid view at bottom */}
          <div className="mt-6 sm:mt-8 md:mt-10 pt-6 sm:pt-8 md:pt-10 border-t border-white/5 px-6 sm:px-10 md:px-16 lg:px-20">
            <div className="flex justify-between items-center mb-4 sm:mb-5">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                All Content
                <span className="text-xs text-gray-500 font-normal bg-white/5 px-2 py-0.5 rounded-full">
                  {filteredFilms.length}
                </span>
              </h2>
            </div>
            
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
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
                      className="group bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] rounded-xl overflow-hidden hover:scale-[1.03] transition-all duration-500 hover:shadow-2xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/40"
                    >
                      <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
                        {film.thumbnail_url ? (
                          <>
                            <Image
                              src={film.thumbnail_url}
                              alt={film.title}
                              fill
                              className="object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl opacity-20 bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]">🎬</div>
                        )}
                        {film.category && (
                          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-[#f5c518]/90 backdrop-blur-sm text-black text-[6px] sm:text-[8px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg">
                            {film.category}
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                          {isPurchased ? (
                            <span className="bg-green-500 text-white text-[6px] sm:text-[8px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
                              <svg className="w-2 h-2 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Owned
                            </span>
                          ) : (
                            <span className="bg-gradient-to-r from-[#f5c518] to-[#ffd700] text-black text-[6px] sm:text-[8px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full shadow-lg">
                              KES {film.price}
                            </span>
                          )}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f5c518]/90 backdrop-blur-sm flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-500 shadow-2xl">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="p-1.5 sm:p-2 md:p-3">
                        <h3 className="font-semibold text-[10px] sm:text-xs md:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
                          {film.title}
                        </h3>
                        <p className="text-gray-500 text-[6px] sm:text-[8px] md:text-xs mt-0.5 truncate flex items-center gap-0.5">
                          <svg className="w-2 h-2 sm:w-3 sm:h-3 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          {film.creator_name || 'Unknown Creator'}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              // List view
              <div className="space-y-3">
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
                      className="flex items-center gap-4 bg-[#1a1a1a] rounded-xl p-3 hover:bg-[#222] transition-all duration-300 border border-white/5 hover:border-[#f5c518]/20 group"
                    >
                      <div className="w-16 h-24 sm:w-20 sm:h-28 bg-[#2a2a2a] rounded-lg overflow-hidden flex-shrink-0 relative">
                        {film.thumbnail_url ? (
                          <Image
                            src={film.thumbnail_url}
                            alt={film.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-20">🎬</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base group-hover:text-[#f5c518] transition-colors line-clamp-1">
                          {film.title}
                        </h3>
                        <p className="text-gray-400 text-xs sm:text-sm mt-0.5 truncate">
                          {film.creator_name || 'Unknown Creator'}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            {film.views || 0}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                              <path fillRule="evenodd" d="M10 4a1 1 0 011 1v5h4a1 1 0 110 2h-5a1 1 0 01-1-1V5a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            {film.purchase_count || 0} sales
                          </span>
                          {film.category && (
                            <span className="bg-[#f5c518]/10 text-[#f5c518] px-2 py-0.5 rounded-full text-[10px]">
                              {film.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isPurchased ? (
                          <span className="bg-green-500/10 text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/20">
                            ✓ Owned
                          </span>
                        ) : (
                          <span className="bg-[#f5c518] text-black text-xs font-semibold px-3 py-1 rounded-full">
                            KES {film.price}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
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
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-[#f5c518]/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-400 text-sm mt-4 animate-pulse">Loading...</p>
        </div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  )
}
