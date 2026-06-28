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

  // ✅ First, find the content by slug
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

  // ✅ Then, check if the user has purchased it
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

  // Other films by same creator
  const { data: otherFilms } = await supabase
    .from('content')
    .select('id, title, thumbnail_url, price, slug, category')
    .eq('creator_id', content.creator_id)
    .eq('status', 'approved')
    .neq('id', content.id)
    .order('created_at', { ascending: false })
    .limit(6)

  // Recommendations: other approved films in same category
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
  
  // ✅ Get the user session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError || !session) {
    console.log('🔒 No session, redirecting to login')
    const currentPath = `/watch/${category}/${slug}`
    redirect(`/auth/login?redirectTo=${currentPath}`)
  }

  console.log('✅ User is logged in:', session.user.email)

  // ✅ Get the data by slug
  const data = await getVideoAndFilmBySlug(slug, session.user.id)

  if (!data) {
    console.error('❌ No data found for slug:', slug)
    notFound()
  }

  // ✅ Verify the category matches
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/library"
              className="text-gray-400 hover:text-white transition text-sm flex items-center gap-2"
            >
              ← Library
            </Link>
            <span className="bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full border border-green-500/20">
              ✓ Purchased
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold truncate">{data.title}</h1>
        </div>

        {/* Main content: video + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: video + description */}
          <div className="lg:col-span-2 space-y-6">
            <WatchPlayer embedUrl={embedUrl} title={data.title} />

            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">About this film</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                {data.description || 'No description provided.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              {data.category && (
                <div><span className="text-gray-500">Category</span> <span className="text-white block">{data.category}</span></div>
              )}
              {data.releaseYear && (
                <div><span className="text-gray-500">Release</span> <span className="text-white block">{data.releaseYear}</span></div>
              )}
              {data.language && (
                <div><span className="text-gray-500">Language</span> <span className="text-white block">{data.language}</span></div>
              )}
              {data.subtitles && (
                <div><span className="text-gray-500">Subtitles</span> <span className="text-white block">{data.subtitles}</span></div>
              )}
            </div>
          </div>

          {/* Right sidebar: creator info + more from this creator */}
          <div className="space-y-6">
            {/* Creator Info */}
            <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Creator</h3>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#2a2a2a] overflow-hidden flex-shrink-0">
                  {data.creator.avatar_url ? (
                    <Image
                      src={data.creator.avatar_url}
                      alt={data.creator.full_name}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">👤</div>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold">{data.creator.full_name}</h4>
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{data.creator.bio || 'Creator'}</p>
                </div>
              </div>
            </div>

            {/* More from this creator */}
            {data.otherFilms.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">More from this creator</h3>
                <div className="space-y-4">
                  {data.otherFilms.map((film) => {
                    const categoryPath = film.category ? film.category.toLowerCase() : 'film'
                    const slug = film.slug || film.id
                    const filmUrl = `/${categoryPath}/${slug}`
                    
                    return (
                      <Link
                        key={film.id}
                        href={filmUrl}
                        className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg transition group"
                      >
                        <div className="w-16 h-16 rounded-lg bg-[#2a2a2a] overflow-hidden flex-shrink-0">
                          {film.thumbnail_url ? (
                            <Image
                              src={film.thumbnail_url}
                              alt={film.title}
                              width={64}
                              height={64}
                              className="object-cover w-full h-full group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">🎬</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate group-hover:text-[#f5c518] transition">
                            {film.title}
                          </h4>
                          <p className="text-[#f5c518] text-sm font-semibold">KES {film.price}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations section below */}
        {data.recommendations.length > 0 && (
          <div className="mt-12 border-t border-white/5 pt-8">
            <h2 className="text-xl font-bold mb-6">You might also like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {data.recommendations.map((film) => {
                const categoryPath = film.category ? film.category.toLowerCase() : 'film'
                const slug = film.slug || film.id
                const filmUrl = `/${categoryPath}/${slug}`
                
                return (
                  <Link
                    key={film.id}
                    href={filmUrl}
                    className="group bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.02] transition border border-white/5 hover:border-[#f5c518]/20"
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
                        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🎬</div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-[#f5c518] transition">
                        {film.title}
                      </h3>
                      <p className="text-gray-400 text-xs">{film.creator_name}</p>
                      <p className="text-[#f5c518] font-bold text-sm mt-1">KES {film.price}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Security notice */}
        <div className="mt-8 flex items-center gap-2 text-xs text-gray-500 border-t border-white/5 pt-4">
          <span>🔒</span>
          <span>Private viewing session – do not share this link</span>
        </div>
      </div>
    </div>
  )
}
