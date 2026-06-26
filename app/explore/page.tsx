'use client'

import { Suspense } from 'react'
import { useState, useEffect, useMemo } from 'react'
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
  creator_name: string | null
}

function ExploreContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { searchTerm, setSearchTerm } = useSearch()

  const [allFilms, setAllFilms] = useState<Film[]>([])
  const [loading, setLoading] = useState(true)
  const [localCategory, setLocalCategory] = useState<string>('All')
  const [userId, setUserId] = useState<string | null>(null)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const query = searchParams.get('search')
    if (query) {
      setSearchTerm(query)
    }
  }, [searchParams, setSearchTerm])

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
          creator_name: creatorNames[item.creator_id] || 'Unknown Creator'
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
    if (localCategory !== 'All') {
      result = result.filter(f => f.category === localCategory)
    }
    return result
  }, [allFilms, searchTerm, localCategory])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">Explore Content</h1>
        <p className="text-gray-400 mb-6">Discover amazing content from creators around the world.</p>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search content, creators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500"
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setLocalCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  localCategory === category
                    ? 'bg-[#f5c518] text-black'
                    : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {filteredFilms.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-2xl p-16 text-center border border-white/5">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-xl text-gray-400">No content found.</p>
            <p className="text-gray-600 text-sm mt-2">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFilms.map((film) => {
              const isPurchased = purchasedIds.has(film.id)
              return (
                <Link
                  key={film.id}
                  href={isPurchased ? `/watch/${film.id}` : `/film/${film.id}`}
                  className="group bg-[#1a1a1a] rounded-2xl overflow-hidden hover:scale-[1.02] transition border border-white/5 hover:border-[#f5c518]/20"
                >
                  <div className="aspect-[2/3] bg-[#2a2a2a] relative">
                    {film.thumbnail_url ? (
                      <Image
                        src={film.thumbnail_url}
                        alt={film.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">🎬</div>
                    )}
                    {film.category && (
                      <div className="absolute top-3 right-3 bg-[#f5c518]/90 text-black text-xs px-3 py-1 rounded-full font-semibold">
                        {film.category}
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3">
                      {isPurchased ? (
                        <span className="bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">✓ Owned</span>
                      ) : (
                        <span className="bg-black/80 text-[#f5c518] text-xs font-bold px-3 py-1 rounded-full">KES {film.price}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-sm group-hover:text-[#f5c518] transition line-clamp-1">
                      {film.title}
                    </h3>
                    <p className="text-gray-500 text-xs mt-1">{film.creator_name || 'Unknown Creator'}</p>
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
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  )
}