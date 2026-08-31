import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface Profile {
  id: string
  full_name: string
  bio: string
  avatar_url: string
  cover_image: string
  is_creator: boolean
  social_instagram: string
  social_twitter: string
  social_youtube: string
  social_website: string
  tagline: string
  featured_project_id: string
}

interface Project {
  id: string
  title: string
  description: string
  thumbnail_url: string
  price: number
  category: string
  slug: string
  views: number
  purchase_count: number
  status: string
  trailer_url: string
  created_at: string
}

interface Stats {
  totalProjects: number
  totalViews: number
  totalPurchases: number
  totalRevenue: number
}

async function getCreatorData(userId: string) {
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return null
  }

  const { data: content } = await supabase
    .from('content')
    .select('*')
    .eq('creator_id', userId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  const totalProjects = content?.length || 0
  const totalViews = content?.reduce((sum, p) => sum + (p.views || 0), 0) || 0
  const totalPurchases = content?.reduce((sum, p) => sum + (p.purchase_count || 0), 0) || 0
  const totalRevenue = content?.reduce((sum, p) => sum + (p.price * (p.purchase_count || 0)), 0) || 0

  let featuredProject = null
  if (profile.featured_project_id) {
    const { data: featured } = await supabase
      .from('content')
      .select('*')
      .eq('id', profile.featured_project_id)
      .single()
    featuredProject = featured
  } else if (content && content.length > 0) {
    featuredProject = content.sort((a, b) => (b.views || 0) - (a.views || 0))[0]
  }

  const { data: { session } } = await supabase.auth.getSession()
  const isOwner = session?.user?.id === userId

  return {
    profile,
    content: content || [],
    stats: { totalProjects, totalViews, totalPurchases, totalRevenue },
    featuredProject,
    isOwner,
    userId: session?.user?.id || null,
  }
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2)
}

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getCreatorData(id)

  if (!data) {
    notFound()
  }

  const { profile, content, stats, featuredProject, isOwner, userId } = data

  // ──────────────────────────────────────────────────────────────
  // 🚀 ONBOARDING FOR NON-CREATORS (CLEAR & DIRECT)
  // ──────────────────────────────────────────────────────────────
  if (isOwner && !profile.is_creator) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8 sm:p-12 text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              You're not a creator yet.
            </h1>
            <p className="text-gray-400 mt-3 text-base max-w-lg mx-auto">
              To upload films, earn 70% of every sale, and build your audience, you need to set up your creator profile first.
            </p>

            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 mt-6 text-left border border-white/5 max-w-md mx-auto">
              <p className="text-sm text-gray-300">
                <span className="text-[#f5c518] font-bold">Step 1:</span> Go to your <strong>Profile</strong>
              </p>
              <p className="text-sm text-gray-300 mt-2">
                <span className="text-[#f5c518] font-bold">Step 2:</span> Toggle <strong>"Become a Creator"</strong> on
              </p>
              <p className="text-sm text-gray-300 mt-2">
                <span className="text-[#f5c518] font-bold">Step 3:</span> Fill in your creator details and start uploading! 🚀
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Link
                href="/profile"
                className="bg-[#f5c518] text-black px-8 py-3 rounded-full font-semibold hover:scale-105 transition-all duration-300"
              >
                Go to Profile → Become a Creator
              </Link>
              <Link
                href="/how-it-works"
                className="border border-white/30 text-white px-8 py-3 rounded-full font-semibold hover:bg-white/10 transition-all duration-300"
              >
                Learn More
              </Link>
            </div>
            <p className="text-gray-500 text-sm mt-4">
              ⏳ Takes less than 2 minutes to set up
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────
  // 🎬 FULL CREATOR PROFILE (Existing)
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      
      {/* Cover Banner */}
      <div className="relative w-full h-[200px] sm:h-[280px] md:h-[350px] bg-gradient-to-r from-[#f5c518]/20 to-[#f5c518]/5 overflow-hidden">
        {profile.cover_image ? (
          <Image
            src={profile.cover_image}
            alt="Cover"
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#f5c518]/10 flex items-center justify-center mx-auto">
                <span className="text-4xl">🎬</span>
              </div>
              <p className="text-gray-500 text-sm mt-3">Creator Cover</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
        
        {isOwner && profile.is_creator && (
          <Link
            href={`/creator/${id}/edit-cover`}
            className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-black/80 px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Cover
          </Link>
        )}
      </div>

      {/* Profile Info */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          
          {/* Avatar */}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-[#1a1a1a] border-4 border-[#0a0a0a] overflow-hidden flex-shrink-0 group">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl text-gray-500">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwner && profile.is_creator && (
              <Link
                href={`/creator/${id}/edit-avatar`}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-medium"
              >
                Edit
              </Link>
            )}
          </div>

          {/* Name & Info */}
          <div className="flex-1 pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {profile.full_name}
              </h1>
              {profile.is_creator && (
                <span className="text-xs bg-green-500/20 text-green-400 px-3 py-0.5 rounded-full border border-green-500/20">
                  Creator
                </span>
              )}
            </div>
            
            {profile.tagline && (
              <p className="text-gray-300 text-sm sm:text-base mt-1">
                {profile.tagline}
              </p>
            )}
            
            <p className="text-gray-400 text-sm mt-2 max-w-2xl">
              {profile.bio || 'No bio yet'}
            </p>
            
            {profile.is_creator && (
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-3">
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <span className="font-bold text-white">{stats.totalProjects}</span> Projects
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <span className="font-bold text-white">{stats.totalViews}</span> Views
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <span className="font-bold text-white">{stats.totalPurchases}</span> Purchases
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <span className="font-bold text-white">KES {formatCurrency(stats.totalRevenue)}</span> Revenue
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            {isOwner && profile.is_creator && (
              <Link
                href={`/creator/${id}/analytics`}
                className="px-4 py-2 bg-[#f5c518]/10 hover:bg-[#f5c518]/20 border border-[#f5c518]/30 text-[#f5c518] rounded-lg text-sm font-medium transition flex items-center gap-2"
              >
                <span>📊</span>
                <span className="hidden sm:inline">Analytics</span>
              </Link>
            )}
            
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
            
            <div className="flex items-center gap-1">
              <a
                href="mailto:reialproduction@gmail.com"
                className="p-2 bg-[#1a1a1a] rounded-lg hover:bg-white/5 transition border border-white/5"
                title="Email"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-[#f5c518] transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
              <a
                href="https://wa.me/254704908255"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-[#1a1a1a] rounded-lg hover:bg-green-500/10 transition border border-white/5"
                title="WhatsApp"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-green-400 transition" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
            
            {isOwner && (
              <button
                onClick={async () => {
                  const supabase = await createClient()
                  await supabase.auth.signOut()
                  window.location.href = '/'
                }}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SOCIAL LINKS & CONTENT (only shown if creator) */}
      {/* ────────────────────────────────────────────────────────────── */}
      {profile.is_creator && (
        <>
          {(profile.social_instagram || profile.social_twitter || profile.social_youtube || profile.social_website) && (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
              <div className="flex flex-wrap gap-3">
                {profile.social_instagram && (
                  <a href={profile.social_instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm flex items-center gap-2">
                    Instagram
                  </a>
                )}
                {profile.social_twitter && (
                  <a href={profile.social_twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm flex items-center gap-2">
                    Twitter
                  </a>
                )}
                {profile.social_youtube && (
                  <a href={profile.social_youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm flex items-center gap-2">
                    YouTube
                  </a>
                )}
                {profile.social_website && (
                  <a href={profile.social_website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm flex items-center gap-2">
                    Website
                  </a>
                )}
              </div>
            </div>
          )}

          {featuredProject && (
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-[#f5c518]">Featured Project</h2>
                {isOwner && (
                  <Link
                    href={`/creator/${id}/edit-featured`}
                    className="text-sm text-gray-400 hover:text-[#f5c518] transition"
                  >
                    Change Featured
                  </Link>
                )}
              </div>
              <Link
                href={`/${featuredProject.category.toLowerCase()}/${featuredProject.slug || featuredProject.id}`}
                className="group block bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/5 hover:border-[#f5c518]/20 transition"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1 aspect-[16/9] md:aspect-[4/3] bg-[#2a2a2a] relative overflow-hidden">
                    {featuredProject.thumbnail_url ? (
                      <Image
                        src={featuredProject.thumbnail_url}
                        alt={featuredProject.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-20">🎬</div>
                    )}
                  </div>
                  <div className="md:col-span-2 p-5 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-[#f5c518]/20 text-[#f5c518] px-2 py-0.5 rounded-full">Featured</span>
                      <span className="text-xs text-gray-500">{featuredProject.category}</span>
                    </div>
                    <h3 className="text-xl font-bold group-hover:text-[#f5c518] transition">
                      {featuredProject.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                      {featuredProject.description}
                    </p>
                    <div className="flex items-center gap-4 mt-4">
                      <span className="text-[#f5c518] font-bold">KES {featuredProject.price}</span>
                      <span className="text-gray-500 text-sm">Views: {featuredProject.views}</span>
                      <span className="text-gray-500 text-sm">Sold: {featuredProject.purchase_count}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">All Projects</h2>
              {isOwner && (
                <Link
                  href="/upload"
                  className="text-sm bg-[#f5c518] text-black px-4 py-1.5 rounded-lg font-semibold hover:bg-[#e0b010] transition"
                >
                  Upload New
                </Link>
              )}
            </div>

            {content.length === 0 ? (
              <div className="bg-[#1a1a1a] rounded-xl p-12 text-center border border-white/5">
                <div className="text-5xl mb-4 opacity-20">🎬</div>
                <p className="text-gray-400">No projects yet</p>
                {isOwner && (
                  <Link href="/upload" className="inline-block mt-4 bg-[#f5c518] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition">
                    Upload Your First Project
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {content.map((project) => (
                  <div key={project.id} className="group relative">
                    <Link
                      href={`/${project.category.toLowerCase()}/${project.slug || project.id}`}
                      className="block bg-[#1a1a1a] rounded-xl overflow-hidden hover:scale-[1.03] transition border border-white/5 hover:border-[#f5c518]/20"
                    >
                      <div className="aspect-[2/3] bg-[#2a2a2a] relative overflow-hidden">
                        {project.thumbnail_url ? (
                          <Image
                            src={project.thumbnail_url}
                            alt={project.title}
                            fill
                            className="object-cover group-hover:scale-110 transition duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">🎬</div>
                        )}
                        {project.category && (
                          <div className="absolute top-2 right-2 bg-[#f5c518]/90 text-black text-[8px] px-2 py-0.5 rounded font-semibold">
                            {project.category}
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm group-hover:text-[#f5c518] transition line-clamp-1">
                          {project.title}
                        </h3>
                        <p className="text-[#f5c518] font-bold text-sm mt-1">KES {project.price}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                          <span>Views: {project.views}</span>
                          <span>Sold: {project.purchase_count}</span>
                        </div>
                      </div>
                    </Link>
                    
                    {isOwner && (
                      <Link
                        href={`/creator/${id}/project/${project.id}/analytics`}
                        className="absolute bottom-2 right-2 bg-[#0a0a0a]/80 hover:bg-[#f5c518] text-white hover:text-black px-2 py-1 rounded text-[8px] font-medium transition opacity-0 group-hover:opacity-100"
                      >
                        Analytics
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* CONTACT / FOOTER – UPDATED WITH SECOND EMAIL */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        <div className="mt-12 pt-6 border-t border-white/10 text-sm text-gray-500 flex flex-wrap justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-white">Contact Us</p>
            <p>Email: reialproduction@gmail.com</p>
            <p>Email: habari@tucheki.com</p>
            <p>WhatsApp: Chat with us</p>
          </div>
          <div className="text-right">
            <p>© 2026 Cheki. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp */}
      <a
        href="https://wa.me/254704908255"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
          <div className="relative w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
        </div>
      </a>
    </div>
  )
}
