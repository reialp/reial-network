import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import WatchPlayer from './WatchPlayer'

type WatchData = {
  videoUrl: string
  title: string
  description: string
  category: string
  releaseYear: string
  language: string
  subtitles: string
  creator: {
    id: string
    full_name: string
    bio: string
    avatar_url: string
  }
  otherFilms: {
    id: string
    title: string
    thumbnail_url: string
    price: number
    slug: string | null
    category: string | null
  }[]
  recommendations: {
    id: string
    title: string
    thumbnail_url: string
    price: number
    creator_name: string
    slug: string | null
    category: string | null
  }[]
}

async function getVideoAndFilmBySlug(slug: string, userId: string): Promise<WatchData | null> {
  const supabase = await createClient()

  const { data: contentData, error: contentError } = await supabase
    .from('content')
    .select(`
      id,
      title,
      description,
      video_url,
      category,
      release_year,
      language,
      subtitles,
      slug,
      creator_id,
      profiles:creator_id (
        id,
        full_name,
        bio,
        avatar_url
      )
    `)
    .eq('slug', slug)
    .single()

  if (contentError || !contentData) {
    console.error('❌ Content not found for slug:', slug)
    return null
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .select('*')
    .eq('content_id', contentData.id)
    .eq('buyer_id', userId)
    .is('revoked_at', null)
    .single()

  if (purchaseError || !purchase) {
    console.error('❌ No purchase found for user:', userId, 'content:', contentData.id)
    return null
  }

  const content = contentData as any
  const creator = content.profiles as any

  const { data: otherFilms } = await supabase
    .from('content')
    .select('id, title, thumbnail_url, price, slug, category')
    .eq('creator_id', content.creator_id)
    .eq('status', 'approved')
    .neq('id', content.id)
    .order('created_at', { ascending: false })
    .limit(6)

  const { data: recs } = await supabase
    .from('content')
    .select('id, title, thumbnail_url, price, slug, category, profiles(full_name)')
    .eq('status', 'approved')
    .eq('category', content.category)
    .neq('id', content.id)
    .neq('creator_id', content.creator_id)
    .order('purchase_count', { ascending: false })
    .limit(4)

  const recommendations = (recs || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    thumbnail_url: r.thumbnail_url,
    price: r.price,
    creator_name: r.profiles?.full_name || 'Unknown',
    slug: r.slug || null,
    category: r.category || null,
  }))

  return {
    videoUrl: content.video_url,
    title: content.title || 'Untitled',
    description: content.description || '',
    category: content.category || '',
    releaseYear: content.release_year || '',
    language: content.language || '',
    subtitles: content.subtitles || '',
    creator: {
      id: creator?.id || '',
      full_name: creator?.full_name || 'Unknown Creator',
      bio: creator?.bio || '',
      avatar_url: creator?.avatar_url || '',
    },
    otherFilms: (otherFilms || []).map((f: any) => ({
      id: f.id,
      title: f.title,
      thumbnail_url: f.thumbnail_url,
      price: f.price,
      slug: f.slug || null,
      category: f.category || null,
    })),
    recommendations: recommendations || [],
  }
}

function getEmbedUrl(url: string): string {
  if (!url) return ''
  if (url.includes('/embed/')) return url
  if (url.includes('player.vimeo.com')) return url

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
  if (ytMatch) {
    const videoId = ytMatch[1]
    return `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return url
}

export default async function WatchPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params
  
  console.log('🔍 WatchPage - Category:', category, 'Slug:', slug)

  const supabase = await createClient()
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError || !session) {
    console.log('🔒 No session, redirecting to login')
    const currentPath = `/watch/${category}/${slug}`
    redirect(`/auth/login?redirectTo=${currentPath}`)
  }

  console.log('✅ User is logged in:', session.user.email)

  const data = await getVideoAndFilmBySlug(slug, session.user.id)

  if (!data) {
    console.error('❌ No data found for slug:', slug)
    notFound()
  }

  const contentCategory = data.category ? data.category.toLowerCase() : 'film'
  if (contentCategory !== category) {
    console.error('❌ Category mismatch:', contentCategory, category)
    notFound()
  }

  const embedUrl = getEmbedUrl(data.videoUrl)

  if (!embedUrl) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-yellow-400">Invalid video URL.</p>
          <Link href="/library" className="text-[#f5c518] hover:underline mt-4 block">
            ← Back to Library
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 lg:py-8">
        
        {/* Header - Mobile optimized */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/library"
              className="text-gray-400 hover:text-white transition text-xs sm:text-sm flex items-center gap-1 sm:gap-2"
            >
              ← <span className="hidden xs:inline">Library</span>
            </Link>
            <span className="bg-green-500/20 text-green-400 text-[8px] sm:text-xs px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-green-500/20">
              ✓ Purchased
            </span>
          </div>
          <h1 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold truncate max-w-[140px] xs:max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
            {data.title}
          </h1>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          
          {/* Left column: video + description */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Video Player - Full width on mobile */}
            <div className="relative w-full aspect-video bg-[#0a0a0a] rounded-lg sm:rounded-xl overflow-hidden border border-white/5">
              <WatchPlayer embedUrl={embedUrl} title={data.title} />
            </div>

            {/* Description - Mobile optimized */}
            <div className="px-1 sm:px-0">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1 sm:mb-2">About this film</h3>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed">
                {data.description || 'No description provided.'}
              </p>
            </div>

            {/* Details grid - Mobile optimized */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm px-1 sm:px-0">
              {data.category && (
                <div>
                  <span className="text-gray-500 text-[10px] sm:text-xs block">Category</span>
                  <span className="text-white text-xs sm:text-sm">{data.category}</span>
                </div>
              )}
              {data.releaseYear && (
                <div>
                  <span className="text-gray-500 text-[10px] sm:text-xs block">Release</span>
                  <span className="text-white text-xs sm:text-sm">{data.releaseYear}</span>
                </div>
              )}
              {data.language && (
                <div>
                  <span className="text-gray-500 text-[10px] sm:text-xs block">Language</span>
                  <span className="text-white text-xs sm:text-sm">{data.language}</span>
                </div>
              )}
              {data.subtitles && (
                <div>
                  <span className="text-gray-500 text-[10px] sm:text-xs block">Subtitles</span>
                  <span className="text-white text-xs sm:text-sm">{data.subtitles}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
            
            {/* Creator Info - Mobile optimized */}
            <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 border border-white/5">
              <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 md:mb-4">Creator</h3>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-[#2a2a2a] overflow-hidden flex-shrink-0">
                  {data.creator.avatar_url ? (
                    <Image
                      src={data.creator.avatar_url}
                      alt={data.creator.full_name}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl text-gray-500">👤</div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-semibold">{data.creator.full_name}</h4>
                  <p className="text-gray-400 text-[10px] sm:text-xs mt-0.5 line-clamp-2">{data.creator.bio || 'Creator'}</p>
                </div>
              </div>
            </div>

            {/* More from this creator - Mobile optimized */}
            {data.otherFilms.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 lg:p-6 border border-white/5">
                <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 md:mb-4">More from this creator</h3>
                <div className="space-y-2 sm:space-y-3">
                  {data.otherFilms.slice(0, 4).map((film) => {
                    const categoryPath = film.category ? film.category.toLowerCase() : 'film'
                    const slug = film.slug || film.id
                    const filmUrl = `/${categoryPath}/${slug}`
                    
                    return (
                      <Link
                        key={film.id}
                        href={filmUrl}
                        className="flex items-center gap-2 sm:gap-3 hover:bg-white/5 p-1.5 sm:p-2 rounded-lg transition group"
                      >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg bg-[#2a2a2a] overflow-hidden flex-shrink-0">
                          {film.thumbnail_url ? (
                            <Image
                              src={film.thumbnail_url}
                              alt={film.title}
                              width={56}
                              height={56}
                              className="object-cover w-full h-full group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl opacity-20">🎬</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-medium truncate group-hover:text-[#f5c518] transition">
                            {film.title}
                          </h4>
                          <p className="text-[#f5c518] text-xs sm:text-sm font-semibold">KES {film.price}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations section - Mobile optimized */}
        {data.recommendations.length > 0 && (
          <div className="mt-6 sm:mt-8 md:mt-10 lg:mt-12 border-t border-white/5 pt-6 sm:pt-8">
            <h2 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-6">You might also like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {data.recommendations.map((film) => {
                const categoryPath = film.category ? film.category.toLowerCase() : 'film'
                const slug = film.slug || film.id
                const filmUrl = `/${categoryPath}/${slug}`
                
                return (
                  <Link
                    key={film.id}
                    href={filmUrl}
                    className="group bg-[#1a1a1a] rounded-lg sm:rounded-xl overflow-hidden hover:scale-[1.02] transition border border-white/5 hover:border-[#f5c518]/20"
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
                        <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl opacity-20">🎬</div>
                      )}
                    </div>
                    <div className="p-1.5 sm:p-2 md:p-3">
                      <h3 className="text-[10px] sm:text-xs md:text-sm font-semibold line-clamp-1 group-hover:text-[#f5c518] transition">
                        {film.title}
                      </h3>
                      <p className="text-gray-400 text-[8px] sm:text-[10px] md:text-xs">{film.creator_name}</p>
                      <p className="text-[#f5c518] font-bold text-[10px] sm:text-xs md:text-sm mt-0.5">KES {film.price}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Security notice - Mobile optimized */}
        <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[8px] sm:text-xs text-gray-500 border-t border-white/5 pt-3 sm:pt-4">
          <span>🔒</span>
          <span>Private viewing session – do not share this link</span>
        </div>
      </div>
    </div>
  )
}
