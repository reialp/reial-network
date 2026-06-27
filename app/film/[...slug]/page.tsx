import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

function getEmbedUrl(url: string): string {
  if (!url) return ''
  if (url.includes('/embed/')) return url
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`
  return url
}

async function getFilmBySlug(slug: string, userId?: string, isAdmin?: boolean) {
  const supabase = await createClient()
  
  // ✅ Query by slug instead of ID
  let query = supabase
    .from('content')
    .select(`*, profiles!inner ( full_name, bio, avatar_url )`)
    .eq('slug', slug)  // ← This is the key change!

  if (!isAdmin) {
    if (userId) {
      const { data: filmCheck } = await supabase
        .from('content')
        .select('creator_id')
        .eq('slug', slug)
        .single()
      if (filmCheck && filmCheck.creator_id !== userId) {
        query = query.eq('status', 'approved')
      }
    } else {
      query = query.eq('status', 'approved')
    }
  }
  
  const { data, error } = await query.single()
  if (error || !data) return null
  return data
}

async function hasUserPurchased(userId: string, contentId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('purchases')
    .select('id')
    .eq('buyer_id', userId)
    .eq('content_id', contentId)
    .is('revoked_at', null)
    .maybeSingle()
  return !!data
}

export default async function FilmPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { slug } = await params
  console.log('🔍 FilmPage - Slug:', slug)

  if (!slug) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400">Invalid Film</h1>
          <p className="text-gray-400 mt-2">No film slug provided.</p>
          <Link href="/" className="text-[#f5c518] hover:underline mt-4 block">Return Home</Link>
        </div>
      </div>
    )
  }

  const sp = await searchParams
  const isPreview = sp.preview === 'true'

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  let isUserAdmin = false
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    isUserAdmin = profile?.is_admin || false
  }

  const film = await getFilmBySlug(slug, userId, isUserAdmin)
  if (!film) notFound()

  const profile = film.profiles as any
  const isOwnFilm = userId && film.creator_id === userId
  const isApproved = film.status === 'approved'

  let hasPurchased = false
  if (userId) {
    hasPurchased = await hasUserPurchased(userId, film.id)
  }

  const canWatchFull = (isApproved || isOwnFilm || isUserAdmin) &&
    (hasPurchased || isOwnFilm || isUserAdmin || isPreview)

  const showFeeBreakdown = isOwnFilm || isUserAdmin

  const embedVideoUrl = getEmbedUrl(film.video_url)
  const embedTrailerUrl = film.trailer_url ? getEmbedUrl(film.trailer_url) : ''

  // ✅ Use the film ID for checkout (UUID)
  const checkoutId = film.id

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isOwnFilm && !isApproved && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm">
              ⚠️ Preview mode – only you can see this.
              {film.status === 'pending' && ' This film is awaiting admin approval.'}
            </p>
          </div>
        )}
        {isUserAdmin && !isApproved && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-400 text-sm">👁️ Admin preview – this film is <strong>{film.status}</strong>.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {canWatchFull ? (
              <div className="aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden relative mb-6">
                {embedVideoUrl ? (
                  <iframe
                    src={embedVideoUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20">🎬</div>
                )}
              </div>
            ) : (
              <div className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden mb-6">
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
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">{film.title}</h2>
                  <p className="text-gray-300 text-sm mb-4">By {profile?.full_name || 'Unknown Creator'}</p>
                  <Link
                    href={`/checkout/${checkoutId}`}
                    className="bg-[#f5c518] text-black px-8 py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition text-lg"
                  >
                    Buy Now – KES {film.price}
                  </Link>
                </div>
              </div>
            )}

            <h1 className="text-3xl font-bold">{film.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400 flex-wrap">
              <span>By {profile?.full_name || 'Unknown Creator'}</span>
              {film.category && <span>• {film.category}</span>}
              {film.release_year && <span>• {film.release_year}</span>}
              {film.language && <span>• {film.language}</span>}
              {film.subtitles && <span>• Subtitles: {film.subtitles}</span>}
            </div>
            <p className="mt-4 text-gray-300">{film.description}</p>

            {embedTrailerUrl && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Trailer</h3>
                <div className="aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden">
                  <iframe
                    src={embedTrailerUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 sticky top-8">
              <div className="text-3xl font-bold text-[#f5c518] mb-2">KES {film.price}</div>
              <p className="text-sm text-gray-400 mb-4">One-time purchase. Watch anytime.</p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-green-400">✓</span> Full HD streaming
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-green-400">✓</span> Watch anytime, anywhere
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-green-400">✓</span> Support the creator directly
                </div>
              </div>

              {isApproved ? (
                <Link
                  href={`/checkout/${checkoutId}`}
                  className="block w-full text-center bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition"
                >
                  Buy Now – KES {film.price}
                </Link>
              ) : (
                <div className="block w-full text-center bg-gray-600 text-gray-300 py-3 rounded-lg font-semibold cursor-not-allowed">
                  {film.status === 'pending' ? 'Pending Approval' : 'Not Available'}
                </div>
              )}

              {showFeeBreakdown && isApproved && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 space-y-1">
                  <p>Platform Fee (15%): <span className="text-yellow-400">KES {Math.round(film.price * 0.15)}</span></p>
                  <p>You Earn (85%): <span className="text-green-400">KES {Math.round(film.price * 0.85)}</span></p>
                </div>
              )}

              <p className="text-xs text-gray-500 text-center mt-3">
                Secure payment via Pesapal. No refunds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
