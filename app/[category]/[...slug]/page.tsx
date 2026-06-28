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

// ✅ Function to increment views
async function incrementViews(contentId: string) {
  try {
    const supabase = await createClient()
    await supabase.rpc('increment_views', { content_id: contentId })
    console.log('✅ View incremented for content:', contentId)
  } catch (error) {
    console.error('❌ Error incrementing views:', error)
  }
}

// ✅ Get content by slug (works for all categories)
async function getContentByIdentifier(identifier: string, userId?: string, isAdmin?: boolean) {
  const supabase = await createClient()
  
  const isUUID = identifier.includes('-') && identifier.length === 36
  
  let query = supabase
    .from('content')
    .select(`*, profiles!inner ( full_name, bio, avatar_url )`)
  
  if (isUUID) {
    query = query.eq('id', identifier)
  } else {
    query = query.eq('slug', identifier)
  }

  if (!isAdmin) {
    if (userId) {
      const filmCheck = await supabase
        .from('content')
        .select('creator_id')
        .eq(isUUID ? 'id' : 'slug', identifier)
        .single()
      if (filmCheck.data && filmCheck.data.creator_id !== userId) {
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

export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; slug: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // ✅ Get category and slug from URL
  const { category, slug } = await params
  const identifier = slug ? slug[slug.length - 1] : null
  
  console.log('🔍 ContentPage - Category:', category, 'Identifier:', identifier)

  if (!identifier || identifier === 'undefined' || identifier === 'null') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400">Invalid Content</h1>
          <p className="text-gray-400 mt-2">No content identifier provided.</p>
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

  const content = await getContentByIdentifier(identifier, userId, isUserAdmin)
  if (!content) notFound()

  // ✅ Increment views (don't await - do it in the background)
  incrementViews(content.id).catch(err => console.error('View increment error:', err))

  const profile = content.profiles as any
  const isOwnContent = userId && content.creator_id === userId
  const isApproved = content.status === 'approved'

  let hasPurchased = false
  if (userId) {
    hasPurchased = await hasUserPurchased(userId, content.id)
  }

  const canWatchFull = (isApproved || isOwnContent || isUserAdmin) &&
    (hasPurchased || isOwnContent || isUserAdmin || isPreview)

  const showFeeBreakdown = isOwnContent || isUserAdmin

  const embedVideoUrl = getEmbedUrl(content.video_url)
  const embedTrailerUrl = content.trailer_url ? getEmbedUrl(content.trailer_url) : ''

  const checkoutId = content.id

  // ✅ Get the correct category path for links
  const categoryPath = content.category ? content.category.toLowerCase() : 'film'

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isOwnContent && !isApproved && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm">
              ⚠️ Preview mode – only you can see this.
              {content.status === 'pending' && ' This content is awaiting admin approval.'}
            </p>
          </div>
        )}
        {isUserAdmin && !isApproved && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-400 text-sm">👁️ Admin preview – this content is <strong>{content.status}</strong>.</p>
          </div>
        )}

        {/* ✅ Category Badge at top */}
        <div className="mb-4">
          <span className="inline-block bg-[#f5c518]/20 text-[#f5c518] text-sm font-semibold px-4 py-1.5 rounded-full border border-[#f5c518]/30">
            {content.category || 'Film'}
          </span>
        </div>

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
                {content.thumbnail_url ? (
                  <Image
                    src={content.thumbnail_url}
                    alt={content.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20 bg-[#1a1a1a]">🎬</div>
                )}
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-6">
                  <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">{content.title}</h2>
                  <p className="text-gray-300 text-sm mb-4">By {profile?.full_name || 'Unknown Creator'}</p>
                  <Link
                    href={`/checkout/${checkoutId}`}
                    className="bg-[#f5c518] text-black px-8 py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition text-lg"
                  >
                    Buy Now – KES {content.price}
                  </Link>
                </div>
              </div>
            )}

            <h1 className="text-3xl font-bold">{content.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400 flex-wrap">
              <span>By {profile?.full_name || 'Unknown Creator'}</span>
              {content.category && <span>• {content.category}</span>}
              {content.release_year && <span>• {content.release_year}</span>}
              {content.language && <span>• {content.language}</span>}
              {content.subtitles && <span>• Subtitles: {content.subtitles}</span>}
            </div>
            <p className="mt-4 text-gray-300">{content.description}</p>

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
              <div className="text-3xl font-bold text-[#f5c518] mb-2">KES {content.price}</div>
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
                  Buy Now – KES {content.price}
                </Link>
              ) : (
                <div className="block w-full text-center bg-gray-600 text-gray-300 py-3 rounded-lg font-semibold cursor-not-allowed">
                  {content.status === 'pending' ? 'Pending Approval' : 'Not Available'}
                </div>
              )}

              {showFeeBreakdown && isApproved && (
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 space-y-1">
                  <p>Platform Fee (15%): <span className="text-yellow-400">KES {Math.round(content.price * 0.15)}</span></p>
                  <p>You Earn (85%): <span className="text-green-400">KES {Math.round(content.price * 0.85)}</span></p>
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
