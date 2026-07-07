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
    loadPurchases()

    const channel = supabase
      .channel('library-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'purchases',
        },
        () => {
          console.log('🔄 New purchase detected, refreshing library...')
          loadPurchases()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadPurchases = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }
    setUserId(session.user.id)

    const { data: purchasesData, error: purchasesError } = await supabase
      .from('purchases')
      .select(`
        id,
        content_id,
        watch_token,
        status,
        created_at,
        revoked_at
      `)
      .eq('buyer_id', session.user.id)
      .eq('status', 'completed')
      .is('revoked_at', null)
      .order('created_at', { ascending: false })

    if (purchasesError || !purchasesData || purchasesData.length === 0) {
      console.log('No purchases found:', purchasesError)
      setLoading(false)
      return
    }

    console.log('Found purchases:', purchasesData.length)

    const contentIds = purchasesData.map(p => p.content_id).filter(id => id)

    if (contentIds.length === 0) {
      setLoading(false)
      return
    }

    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        price,
        slug,
        category,
        creator_id,
        profiles!content_creator_id_fkey (
          full_name
        )
      `)
      .in('id', contentIds)
      .eq('status', 'approved')

    if (contentError) {
      console.error('Error fetching content:', contentError)
      setLoading(false)
      return
    }

    console.log('Found content:', contentData?.length)

    const contentMap: { [key: string]: any } = {}
    contentData?.forEach((content: any) => {
      contentMap[content.id] = content
    })

    const getCreatorName = (profilesField: any): string => {
      if (!profilesField) return 'Unknown Creator'
      if (Array.isArray(profilesField)) {
        return profilesField[0]?.full_name || 'Unknown Creator'
      }
      return profilesField.full_name || 'Unknown Creator'
    }

    const mapped = purchasesData
      .filter(purchase => contentMap[purchase.content_id])
      .map((purchase: any) => {
        const content = contentMap[purchase.content_id]
        const creatorName = getCreatorName(content?.profiles)
        
        return {
          token: purchase.watch_token || purchase.id,
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

    console.log('Mapped purchases:', mapped.length)
    setPurchases(mapped)
    setLoading(false)
  }

  const filteredPurchases = useMemo(() => {
    if (!searchTerm.trim()) return purchases
    const term = searchTerm.toLowerCase()
    return purchases.filter(purchase =>
      purchase.film.title.toLowerCase().includes(term) ||
      purchase.creator_name.toLowerCase().includes(term)
    )
  }, [purchases, searchTerm])

  const groupedPurchases = useMemo(() => {
    const grouped: Record<string, Purchase[]> = {}
    filteredPurchases.forEach(purchase => {
      const category = purchase.film.category_label || 'Other'
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(purchase)
    })
    return grouped
  }, [filteredPurchases])

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
    const watchUrl = `/watch/${purchase.film.category}/${purchase.film.slug}?token=${encodeURIComponent(purchase.token)}`
    
    return (
      <Link
        key={purchase.token}
        href={watchUrl}
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
      <div className="mb-4 sm:mb-8 md:mb-10 px-4 sm:px-6 md:px-8 lg:px-10 group/row">
        <div className="flex justify-between items-center mb-2 sm:mb-3 md:mb-4">
          <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white">
            {title}
          </h2>
          {items.length > 6 && (
            <button 
              onClick={() => {
                const element = document.getElementById('all-purchased')
                if (element) element.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-[#f5c518] text-xs sm:text-sm hover:underline font-medium"
            >
              See All →
            </button>
          )}
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

          {/* Gradient fades REMOVED - no more haze */}

          <div
            ref={(el) => { scrollContainerRefs.current[rowId] = el }}
            className="overflow-x-auto scrollbar-hide px-4 sm:px-0 pb-3 sm:pb-4 -mx-4 sm:mx-0 scroll-smooth"
          >
            <div className="flex gap-2.5 sm:gap-3 md:gap-4 px-4 sm:px-0">
              {items.map(item => renderFilmCard(item, isLarge))}
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
          <p className="text-gray-400 text-sm sm:text-base">Loading your library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header - with consistent padding */}
      <div className="border-b border-white/5 px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6 md:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Your Library</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">
            {filteredPurchases.length} {filteredPurchases.length === 1 ? 'film' : 'films'} 
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-12 sm:py-16 md:py-24">
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
          
          {/* Continue Watching */}
          {recentPurchases.length > 0 && renderRow('Continue Watching', recentPurchases, 'continue-watching', true)}

          {/* Category Rows */}
          {Object.entries(groupedPurchases).map(([category, categoryItems]) => {
            if (category === 'Continue Watching' || categoryItems.length === 0) return null
            const isAllInRecent = categoryItems.every(item => 
              recentPurchases.some(rp => rp.token === item.token)
            )
            if (isAllInRecent && recentPurchases.length > 0) return null
            
            return renderRow(category, categoryItems, `category-${category}`, false)
          })}

          {/* All Purchased */}
          <div id="all-purchased" className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-6 md:pt-8 border-t border-white/5 px-4 sm:px-6 md:px-8 lg:px-10">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold">All Purchased</h2>
              <span className="text-gray-500 text-xs sm:text-sm">{filteredPurchases.length} films</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
              {filteredPurchases.map((purchase) => {
                const watchUrl = `/watch/${purchase.film.category}/${purchase.film.slug}?token=${encodeURIComponent(purchase.token)}`
                return (
                  <Link
                    key={purchase.token}
                    href={watchUrl}
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
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
