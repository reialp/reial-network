'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
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
}

export default function HomePage() {
  const supabase = createClient()
  const { searchTerm, selectedCategory, setSelectedCategory } = useSearch()

  const [allFilms, setAllFilms] = useState<Film[]>([])
  const [loading, setLoading] = useState(true)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())
  const [purchaseTokens, setPurchaseTokens] = useState<Record<string, string>>({}) // NEW
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function fetchFilms() {
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
          creator_id
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
          creator_name: creatorNames[item.creator_id] || 'Unknown Creator'
        }))
        setAllFilms(mappedData)
      }
      setLoading(false)
    }
    fetchFilms()
  }, [supabase])

  // Fetch user's purchases - UPDATED to also get tokens
  useEffect(() => {
    async function fetchPurchases() {
      if (!userId) return
      const { data } = await supabase
        .from('purchases')
        .select('content_id, watch_token')
        .eq('buyer_id', userId)
        .is('revoked_at', null)
      
      if (data) {
        const ids = new Set(data.map(p => p.content_id))
        setPurchasedIds(ids)
        
        // Store tokens keyed by content_id
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

  const totalFilms = allFilms.length
  const totalSales = allFilms.reduce((sum, f) => sum + (f.purchase_count || 0), 0)
  const totalRevenue = allFilms.reduce((sum, f) => sum + (f.price * (f.purchase_count || 0)), 0)

  const carouselFilms = allFilms.slice(0, 5)

  // UPDATED renderFilmCard - uses token for watch link
  const renderFilmCard = (film: Film) => {
    const isPurchased = purchasedIds.has(film.id)
    const token = purchaseTokens[film.id]
    
    return (
      <Link
        key={film.id}
        href={isPurchased && token ? `/watch/${token}` : `/film/${film.id}`}
        className="group bg-[#1a1a1a] rounded-2xl overflow-hidden hover:scale-[1.03] transition-all duration-500 hover:shadow-2xl hover:shadow-[#f5c518]/10 border border-white/5 hover:border-[#f5c518]/20"
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
            <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">🎬</div>
          )}
          {film.category && (
            <div className="absolute top-3 right-3 bg-[#f5c518]/90 text-black text-xs px-3 py-1 rounded-full font-semibold">
              {film.category}
            </div>
          )}
          <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            {isPurchased ? (
              <span className="bg-green-500/90 text-white text-sm font-bold px-3 py-1 rounded-full">✓ Owned</span>
            ) : (
              <span className="bg-black/80 text-[#f5c518] text-sm font-bold px-3 py-1 rounded-full">KES {film.price}</span>
            )}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
            {film.title}
          </h3>
          <p className="text-gray-500 text-xs mt-1">
            {film.creator_name || 'Unknown Creator'}
          </p>
          <div className="flex items-center justify-between mt-3">
            {isPurchased ? (
              <span className="text-green-400 font-bold text-sm">✓ Purchased</span>
            ) : (
              <span className="text-[#f5c518] font-bold text-sm">KES {film.price}</span>
            )}
            <span className="text-gray-600 text-xs">{isPurchased ? '▶ Watch' : '🎬 Watch'}</span>
          </div>
        </div>
      </Link>
    )
  }

  // UPDATED Loading state with spinner
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <section className="relative min-h-screen flex items-center px-6 overflow-hidden bg-grid-pattern">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#1a0a0a] to-[#0a0a0a]">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#f5c518]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#f5c518]/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#f5c518]/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#f5c518]/10 border border-[#f5c518]/20 text-[#f5c518] text-sm font-medium mb-6">
              Premium Content Marketplace
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6">
              Premium Stories.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f5c518] via-[#ffd700] to-[#f5c518]">
                Directly from Creators.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
              Discover and buy exclusive films, documentaries, series and more from amazing creators.
              <span className="block text-gray-500 text-sm mt-2">Thousands of stories, one platform.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/explore"
                className="group bg-[#f5c518] text-black px-8 py-4 rounded-full font-semibold hover:scale-105 transition-all duration-300 hover:shadow-2xl hover:shadow-[#f5c518]/25 flex items-center justify-center gap-2"
              >
                <span>Explore Content</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/auth/signup"
                className="px-8 py-4 border border-white/20 rounded-full font-semibold hover:bg-white/10 transition-all duration-300 hover:scale-105 text-center"
              >
                Become a Creator
              </Link>
            </div>
          </div>

          {carouselFilms.length > 0 && (
            <div
              className="relative aspect-[4/3] max-h-[60vh] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {carouselFilms.map((film, idx) => (
                <div
                  key={film.id}
                  className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                    idx === carouselIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                  }`}
                >
                  {film.thumbnail_url ? (
                    <Image
                      src={film.thumbnail_url}
                      alt={film.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20 bg-[#1a1a1a]">🎬</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <h3 className="text-lg font-bold">{film.title}</h3>
                    <p className="text-sm text-gray-300">{film.creator_name || 'Unknown Creator'}</p>
                    <p className="text-[#f5c518] font-bold">KES {film.price}</p>
                  </div>
                </div>
              ))}
              <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                {carouselFilms.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      idx === carouselIndex ? 'bg-[#f5c518]' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500 animate-bounce">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-4">
        <div className="flex gap-3 flex-wrap">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 ${
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

      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Featured Content</h2>
            <p className="text-gray-500 text-sm mt-1">
              {filteredFilms.length} {filteredFilms.length === 1 ? 'item' : 'items'} available
            </p>
          </div>
        </div>

        {filteredFilms.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-2xl p-16 text-center border border-white/5">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-xl text-gray-400">No content found.</p>
            <p className="text-gray-600 text-sm mt-2">Check back soon for new content.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFilms.map((film) => renderFilmCard(film))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/5 mt-16 px-6 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">Reial<span className="text-[#f5c518]">.</span></span>
            <span className="text-gray-600 text-sm">Premium Stories</span>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#f5c518]">{totalFilms}</p>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Items</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#f5c518]">{totalSales}</p>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Sales</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#f5c518]">KES {totalRevenue.toLocaleString()}</p>
              <p className="text-gray-500 text-xs uppercase tracking-wider">Total Sales</p>
            </div>
          </div>
          <div className="text-gray-500 text-sm">© 2026 Reial Network. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
