import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

async function getCreatorData(userId: string) {
  const supabase = await createClient()

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return null
  }

  // Get their approved content
  const { data: content } = await supabase
    .from('content')
    .select('*')
    .eq('creator_id', userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // Get total sales
  const totalSales = content?.reduce((sum, film) => sum + (film.price * (film.purchase_count || 0)), 0) || 0
  const totalFilms = content?.length || 0
  const followers = 0

  // Get current user session to check if viewing own profile
  const { data: { session } } = await supabase.auth.getSession()
  const isOwner = session?.user?.id === userId

  return {
    profile,
    content: content || [],
    stats: { totalFilms, followers, totalSales },
    isOwner,
  }
}

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getCreatorData(id)

  if (!data) {
    notFound()
  }

  const { profile, content, stats, isOwner } = data

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Creator Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-[#2a2a2a] overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.full_name || 'Creator'} width={96} height={96} className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-gray-500">👤</div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.full_name || 'Creator'}</h1>
            {profile.bio && <p className="text-gray-400 text-sm mt-1">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="text-[#f5c518] font-semibold">{stats.totalFilms} Films</span>
              <span>{stats.followers} Followers</span>
              <span>KES {stats.totalSales.toLocaleString()} Total Sales</span>
            </div>
          </div>

          {/* ✅ Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 📊 Analytics - Only for owner */}
            {isOwner && (
              <Link
                href={`/creator/${id}/analytics`}
                className="px-4 py-2 bg-[#f5c518]/10 hover:bg-[#f5c518]/20 border border-[#f5c518]/30 text-[#f5c518] rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <span>📊</span>
                <span className="hidden sm:inline">Analytics</span>
              </Link>
            )}

            {/* Edit Profile - Only for owner */}
            {isOwner && (
              <Link
                href="/profile"
                className="px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-sm font-medium hover:bg-white/5 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-white/10 mb-6">
          {['Films', 'About', 'Community'].map((tab) => (
            <button
              key={tab}
              className={`pb-3 text-sm font-medium transition ${
                tab === 'Films'
                  ? 'text-[#f5c518] border-b-2 border-[#f5c518]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Films Grid */}
        {content.length === 0 ? (
          <div className="bg-[#1a1a1a] rounded-xl p-12 text-center text-gray-500">
            <p className="text-lg">No films available yet.</p>
            {isOwner && (
              <Link href="/upload" className="inline-block mt-4 bg-[#f5c518] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition">
                Upload Your First Film
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {content.map((film) => (
              <Link
                key={film.id}
                href={`/film/${film.id}`}
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
                  <p className="text-[#f5c518] font-bold text-sm mt-1">KES {film.price}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
