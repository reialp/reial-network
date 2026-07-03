'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearch } from '@/context/SearchContext'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Purchase {
  token: string
  film: {
    id: string
    title: string
    description: string
    thumbnail_url: string | null
    price: number
    slug: string
    category: string
    category_label: string
  }
  creator_name: string
  purchased_at: string
}

export default function LibraryPage() {
  const router = useRouter()
  const supabase = createClient()
  const { searchTerm } = useSearch()
  
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const scrollContainerRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    async function loadPurchases() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }
      setUserId(session.user.id)

      const { data, error } = await supabase
        .from('purchases')
        .select(`
          watch_token,
          content_id,
          created_at,
          content:content_id (
            id,
            title,
            description,
            thumbnail_url,
            price,
            creator_id,
            slug,
            category,
            profiles (
              full_name
            )
          )
        `)
        .eq('buyer_id', session.user.id)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })

      if (error || !data) {
        console.error('Error fetching purchases:', error)
        setLoading(false)
        return
      }

      // Deduplicate by content_id
      const uniqueMap = new Map()
      data.forEach((purchase: any) => {
        const contentId = purchase.content_id
        if (!uniqueMap.has(contentId) || new Date(purchase.created_at) > new Date(uniqueMap.get(contentId).created_at)) {
          uniqueMap.set(contentId, purchase)
        }
      })

      const mapped = Array.from(uniqueMap.values()).map((purchase: any) => {
        const content = purchase.content
        const creatorName = content?.profiles && content.profiles.length > 0 
          ? content.profiles[0].full_name 
          : 'Unknown Creator'
        
        return {
          token: purchase.watch_token,
          film: {
            id: content?.id,
            title: content?.title || 'Untitled',
            description: content?.description || '',
            thumbnail_url: content?.thumbnail_url,
            price: content?.price || 0,
            slug: content?.slug || content?.id,
            category: content?.category ? content.category.toLowerCase() : 'film',
            category_label: content?.category || 'Film',
          },
          creator_name: creatorName,
          purchased_at: purchase.created_at,
        }
      })

      setPurchases(mapped)
      setLoading(false)
    }

    loadPurchases()
  }, [supabase, router])

  // Filter purchases by search term
  const filteredPurchases = useMemo(() => {
    if (!searchTerm.trim()) return purchases
    const term = searchTerm.toLowerCase()
    return purchases.filter(purchase =>
      purchase.film.title.toLowerCase().includes(term) ||
      purchase.creator_name.toLowerCase().includes(term)
    )
  }, [purchases, searchTerm])

  // Group by category for streaming rows
  const groupedPurchases = useMemo(() => {
    const grouped: Record<string, Purchase[]> = {}
    filteredPurchases.forEach(purchase => {
      const category = purchase.film.category_label || 'Other'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(purchase)
    })
    return grouped
  }, [filteredPurchases])

  // Recent purchases (first 10)
  const recentPurchases = filteredPurchases.slice(0, 10)

  const scrollRow = (direction: 'left' | 'right', rowId: string) => {
    const container = scrollContainerRefs.current[rowId]
    if (!container) return
    const scrollAmount = container.clientWidth * 0.8
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  const renderFilmCard = (purchase: Purchase, isLarge: boolean = false) => {
    return (
      <Link
        key={purchase.token}
        href={`/watch/${purchase.film.category}/${purchase.film.slug}`}
        className={`group flex-shrink-0 ${
          isLarge 
            ? 'w-[160px] sm:w-[200px] md:w-[240px] lg:w-[280px]' 
            : 'w-[140px] sm:w-[180px] md:w-[200px] lg:w-[220px]'
        } bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.05] transition-all duration-300 hover:shadow-xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30`}
      >
        <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
          {purchase.film.thumbnail_url ? (
            <Image
              src={purchase.film.thumbnail_url}
              alt={purchase.film.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🎬</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="bg-green-500 text-white text-[8px] sm:text-xs font-bold px-2 py-0.5 rounded-full">✓ Owned</span>
          </div>
          {!isLarge && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[8px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              ▶ Watch
            </div>
          )}
        </div>
        <div className="p-2 sm:p-3">
          <h3 className={`font-semibold ${isLarge ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'} group-hover:text-[#f5c518] transition-colors line-clamp-1`}>
            {purchase.film.title}
          </h3>
          <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5 truncate">
            {purchase.creator_name}
          </p>
        </div>
      </Link>
    )
  }

  const renderRow = (title: string, items: Purchase[], rowId: string, isLarge: boolean = false) => {
    if (items.length === 0) return null
    return (
      <div className="mb-4 sm:mb-8 md:mb-10 group/row">
        <div className="flex justify-between items-center mb-2 sm:mb-3 md:mb-4 px-4 sm:px-0">
          <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white">
            {title}
          </h2>
          {items.length > 6 && (
            <Link href={`/library?category=${encodeURIComponent(title)}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline font-medium">
              See All →
            </Link>
          )}
        </div>
        <div className="relative">
          {/* Scroll buttons - hidden on mobile, visible on hover on desktop */}
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

          {/* Gradient fades - desktop only */}
          <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none hidden sm:block" />
          <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none hidden sm:block" />

          {/* Scroll container */}
          <div
            ref={(el) => { scrollContainerRefs.current[rowId] = el }}
            className="overflow-x-auto scrollbar-hide px-4 sm:px-0 pb-3 sm:pb-4 -mx-4 sm:mx-0 scroll-smooth"
          >
            <div className="flex gap-2.5 sm:gap-3 md:gap-4 px-4 sm:px-0">
              {items.map(item => renderFilmCard(item, isLarge))}
            </div>
          </div>

          {/* Mobile swipe indicator */}
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
          <p className="text-gray-400 text-sm sm:text-base">Loading your library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header - Mobile optimized */}
      <div className="border-b border-white/5 px-4 sm:px-6 py-4 sm:py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Your Library</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
            {filteredPurchases.length} {filteredPurchases.length === 1 ? 'film' : 'films'} 
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-24">
          <div className="bg-[#1a1a1a] rounded-2xl p-8 sm:p-12 md:p-16 text-center border border-white/5">
            <div className="text-5xl sm:text-6xl mb-4">🎬</div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">
              {searchTerm ? 'No matching films' : 'Your library is empty'}
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
              {searchTerm 
                ? `Try a different search term.` 
                : 'Start exploring and purchase films to build your collection.'}
            </p>
            <Link
              href={searchTerm ? '/library' : '/'}
              className="inline-block mt-4 sm:mt-6 bg-[#f5c518] text-black px-5 sm:px-6 md:px-8 py-2 sm:py-2.5 md:py-3 rounded-full font-semibold hover:scale-105 transition-all duration-300 text-sm sm:text-base"
            >
              {searchTerm ? 'Clear Search' : 'Explore Films'}
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto py-3 sm:py-4 md:py-6">
          
          {/* ✅ CONTINUE WATCHING - Large card row */}
          {recentPurchases.length > 0 && renderRow('Continue Watching', recentPurchases, 'continue-watching', true)}

          {/* ✅ CATEGORY ROWS - Streaming style */}
          {Object.entries(groupedPurchases).map(([category, categoryItems]) => {
            // Skip if it's the same as Continue Watching or empty
            if (category === 'Continue Watching' || categoryItems.length === 0) return null
            // Skip if all items are already in Continue Watching
            const isAllInRecent = categoryItems.every(item => 
              recentPurchases.some(rp => rp.token === item.token)
            )
            if (isAllInRecent && recentPurchases.length > 0) return null
            
            return renderRow(category, categoryItems, `category-${category}`, false)
          })}

          {/* ✅ ALL PURCHASED - Grid view at bottom */}
          <div className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-6 md:pt-8 border-t border-white/5 px-4 sm:px-0">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">All Purchased</h2>
              <span className="text-gray-500 text-xs sm:text-sm">{filteredPurchases.length} films</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
              {filteredPurchases.map((purchase) => (
                <Link
                  key={purchase.token}
                  href={`/watch/${purchase.film.category}/${purchase.film.slug}`}
                  className="group bg-[#1a1a1a] rounded-lg sm:rounded-xl overflow-hidden hover:scale-[1.03] transition-all duration-300 hover:shadow-lg hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
                >
                  <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
                    {purchase.film.thumbnail_url ? (
                      <Image
                        src={purchase.film.thumbnail_url}
                        alt={purchase.film.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl opacity-20">🎬</div>
                    )}
                    <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="bg-green-500 text-white text-[6px] sm:text-[8px] font-bold px-1 sm:px-2 py-0.5 rounded-full">✓ Owned</span>
                    </div>
                  </div>
                  <div className="p-1.5 sm:p-2 md:p-3">
                    <h3 className="font-semibold text-[10px] sm:text-xs md:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
                      {purchase.film.title}
                    </h3>
                    <p className="text-gray-500 text-[6px] sm:text-[8px] md:text-xs mt-0.5 truncate">
                      {purchase.creator_name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
