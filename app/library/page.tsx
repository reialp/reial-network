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
        thumbnail_url,
        price,
        creator_id,
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

  // ✅ Deduplicate by content_id (keep the most recent purchase)
  const uniqueMap = new Map()
  data.forEach((purchase: any) => {
    const contentId = purchase.content_id
    if (!uniqueMap.has(contentId) || new Date(purchase.created_at) > new Date(uniqueMap.get(contentId).created_at)) {
      uniqueMap.set(contentId, purchase)
    }
  })

  const uniquePurchases = Array.from(uniqueMap.values())

  return uniquePurchases.map((purchase: any) => {
    // ✅ Extract creator name from profiles array
    const content = purchase.content
    const creatorName = content?.profiles && content.profiles.length > 0 
      ? content.profiles[0].full_name 
      : 'Unknown Creator'
    
    return {
      token: purchase.watch_token,
      film: {
        id: content?.id,
        title: content?.title || 'Untitled',
        thumbnail_url: content?.thumbnail_url,
        price: content?.price || 0,
      },
      creator_name: creatorName,
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your Library</h1>
        <p className="text-gray-400 mb-8">Films you've purchased.</p>

        {purchases.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl p-12 text-center text-gray-500">
            <p className="text-lg">You haven't purchased any films yet.</p>
            <Link href="/" className="text-[#f5c518] hover:underline mt-2 block">
              Explore Films
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {purchases.map((purchase) => (
              <div key={purchase.token} className="bg-[#1a1a1a] rounded-xl overflow-hidden border border-white/10">
                <div className="aspect-[2/3] bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] relative">
                  {purchase.film?.thumbnail_url ? (
                    <Image
                      src={purchase.film.thumbnail_url}
                      alt={purchase.film.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">
                      🎬
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm line-clamp-1">{purchase.film?.title}</h3>
                  <p className="text-gray-400 text-xs mt-1">{purchase.creator_name || 'Unknown Creator'}</p>
                  <Link
                    href={`/watch/${purchase.token}`}
                    className="mt-3 block w-full text-center bg-[#f5c518] text-black py-2 rounded-lg text-sm font-semibold hover:bg-[#e0b010] transition"
                  >
                    Watch Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}