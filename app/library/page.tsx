import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

async function getPurchasedFilms(userId: string) {
  const supabase = await createClient()

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
    .eq('buyer_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching purchases:', error)
    return []
  }

  // Deduplicate by content_id (keep the most recent purchase)
  const uniqueMap = new Map()
  data.forEach((purchase: any) => {
    const contentId = purchase.content_id
    if (!uniqueMap.has(contentId) || new Date(purchase.created_at) > new Date(uniqueMap.get(contentId).created_at)) {
      uniqueMap.set(contentId, purchase)
    }
  })

  const uniquePurchases = Array.from(uniqueMap.values())

  return uniquePurchases.map((purchase: any) => {
    const content = purchase.content
    const creatorName = content?.profiles && content.profiles.length > 0 
      ? content.profiles[0].full_name 
      : 'Unknown Creator'
    
    const categoryPath = content?.category ? content.category.toLowerCase() : 'film'
    const slug = content?.slug || content?.id
    
    return {
      token: purchase.watch_token,
      film: {
        id: content?.id,
        title: content?.title || 'Untitled',
        description: content?.description || '',
        thumbnail_url: content?.thumbnail_url,
        price: content?.price || 0,
        slug: slug,
        category: categoryPath,
        category_label: content?.category || 'Film',
      },
      creator_name: creatorName,
      purchased_at: purchase.created_at,
    }
  })
}

export default async function LibraryPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const purchases = await getPurchasedFilms(session.user.id)

  // Group by category for streaming-style rows
  const groupedPurchases = purchases.reduce((acc: Record<string, typeof purchases>, purchase) => {
    const category = purchase.film.category_label || 'Other'
    if (!acc[category]) acc[category] = []
    acc[category].push(purchase)
    return acc
  }, {})

  // Recently purchased (first 8)
  const recentPurchases = purchases.slice(0, 8)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Your Library</h1>
          <p className="text-gray-400 text-sm mt-1">
            {purchases.length} {purchases.length === 1 ? 'film' : 'films'} purchased
          </p>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="bg-[#1a1a1a] rounded-2xl p-12 sm:p-16 text-center border border-white/5">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Your library is empty</h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Start exploring and purchase films to build your collection.
            </p>
            <Link
              href="/"
              className="inline-block mt-6 bg-[#f5c518] text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold hover:scale-105 transition-all duration-300"
            >
              Explore Films
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          
          {/* ✅ RECENTLY PURCHASED - Horizontal scroll row */}
          <div className="mb-8 sm:mb-12">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Continue Watching</h2>
              {recentPurchases.length > 4 && (
                <Link href="/library/all" className="text-[#f5c518] text-xs sm:text-sm hover:underline">
                  See All →
                </Link>
              )}
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="flex gap-3 sm:gap-4 pb-4">
                {recentPurchases.map((purchase) => (
                  <Link
                    key={purchase.token}
                    href={`/watch/${purchase.film.category}/${purchase.film.slug}`}
                    className="group flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.05] transition-all duration-300 hover:shadow-xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="bg-green-500 text-white text-[8px] sm:text-xs font-bold px-2 py-0.5 rounded-full">✓ Owned</span>
                      </div>
                    </div>
                    <div className="p-2 sm:p-3">
                      <h3 className="font-semibold text-xs sm:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
                        {purchase.film.title}
                      </h3>
                      <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5 truncate">
                        {purchase.creator_name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ✅ CATEGORY ROWS - Streaming style */}
          {Object.entries(groupedPurchases).map(([category, categoryPurchases]) => {
            // Skip if it's the same as "Continue Watching" or empty
            if (category === 'Continue Watching' || categoryPurchases.length === 0) return null
            // Skip if it's the same as recently purchased (already shown)
            const isRecentlyPurchased = categoryPurchases.every(p => 
              recentPurchases.some(rp => rp.token === p.token)
            )
            if (isRecentlyPurchased && recentPurchases.length > 0) return null
            
            return (
              <div key={category} className="mb-8 sm:mb-12">
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold">{category}</h2>
                  {categoryPurchases.length > 4 && (
                    <Link href={`/library?category=${category}`} className="text-[#f5c518] text-xs sm:text-sm hover:underline">
                      See All →
                    </Link>
                  )}
                </div>
                <div className="overflow-x-auto scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
                  <div className="flex gap-3 sm:gap-4 pb-4">
                    {categoryPurchases.slice(0, 10).map((purchase) => (
                      <Link
                        key={purchase.token}
                        href={`/watch/${purchase.film.category}/${purchase.film.slug}`}
                        className="group flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.05] transition-all duration-300 hover:shadow-xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
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
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="bg-green-500 text-white text-[8px] sm:text-xs font-bold px-2 py-0.5 rounded-full">✓ Owned</span>
                          </div>
                        </div>
                        <div className="p-2 sm:p-3">
                          <h3 className="font-semibold text-xs sm:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
                            {purchase.film.title}
                          </h3>
                          <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5 truncate">
                            {purchase.creator_name}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {/* ✅ GRID VIEW - All purchased films */}
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">All Purchased</h2>
              <span className="text-gray-500 text-xs sm:text-sm">{purchases.length} films</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
              {purchases.map((purchase) => (
                <Link
                  key={purchase.token}
                  href={`/watch/${purchase.film.category}/${purchase.film.slug}`}
                  className="group bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.03] transition-all duration-300 hover:shadow-xl hover:shadow-[#f5c518]/20 border border-white/5 hover:border-[#f5c518]/30"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="bg-green-500 text-white text-[8px] sm:text-xs font-bold px-2 py-0.5 rounded-full">✓ Owned</span>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3">
                    <h3 className="font-semibold text-xs sm:text-sm group-hover:text-[#f5c518] transition-colors line-clamp-1">
                      {purchase.film.title}
                    </h3>
                    <p className="text-gray-500 text-[8px] sm:text-xs mt-0.5 truncate">
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
