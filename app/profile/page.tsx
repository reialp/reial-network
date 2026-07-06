'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile {
  full_name: string
  bio: string
  avatar_url: string
  is_creator: boolean
  payout_phone: string
}

function ProfileForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const intent = searchParams.get('intent')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    bio: '',
    avatar_url: '',
    is_creator: false,
    payout_phone: '',
  })

  const [originalProfile, setOriginalProfile] = useState<Profile>({
    full_name: '',
    bio: '',
    avatar_url: '',
    is_creator: false,
    payout_phone: '',
  })

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      setUserId(session.user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || '',
            is_creator: false,
            terms_accepted: false,
          })

        if (!insertError) {
          loadProfile()
          return
        } else {
          setError('Failed to create profile. Please try again.')
          setLoading(false)
          return
        }
      }

      if (data) {
        const loadedProfile = {
          full_name: data.full_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          is_creator: data.is_creator || false,
          payout_phone: data.payout_phone || '',
        }
        setProfile(loadedProfile)
        setOriginalProfile(loadedProfile)
        
        if (!loadedProfile.full_name && !loadedProfile.bio) {
          setIsEditing(true)
        }
      }
      setLoading(false)
    }
    loadProfile()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    if (!userId) {
      setError('Not authenticated')
      setSaving(false)
      return
    }

    const wasCreator = profile.is_creator
    const currentProfile = { ...profile }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: currentProfile.full_name,
        bio: currentProfile.bio,
        avatar_url: currentProfile.avatar_url,
        is_creator: currentProfile.is_creator,
        payout_phone: currentProfile.payout_phone,
      })
      .eq('id', userId)

    if (updateError) {
      setError('Failed to save: ' + updateError.message)
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
    setOriginalProfile({ ...currentProfile })
    setIsEditing(false)

    if (intent === 'creator' && currentProfile.is_creator && !wasCreator) {
      setTimeout(() => {
        router.push('/terms')
      }, 1000)
      return
    }

    setTimeout(() => setSuccess(false), 2000)
  }

  const handleCancel = () => {
    setProfile({ ...originalProfile })
    setIsEditing(false)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading profile...</p>
        </div>
      </div>
    )
  }

  const hasProfile = profile.full_name || profile.bio || profile.avatar_url

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
        
        {/* Header with Avatar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1a1a1a] border-2 border-white/10 overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name || 'Profile'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl text-gray-500">
                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : '👤'}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {profile.full_name || 'Set up your profile'}
            </h1>
            <p className="text-gray-400 text-sm">
              {profile.is_creator ? (
                <span className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                  Creator
                </span>
              ) : (
                'Complete your profile'
              )}
            </p>
          </div>
          {!isEditing && hasProfile && (
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-sm font-medium hover:bg-white/5 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {/* Status Banners */}
        {intent === 'creator' && !profile.is_creator && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3.5 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚀</span>
              <div>
                <p className="text-yellow-400 text-sm font-medium">Become a Creator</p>
                <p className="text-yellow-400/70 text-xs">Check the box below to start uploading and selling your content.</p>
              </div>
            </div>
          </div>
        )}

        {profile.is_creator && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3.5 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-green-400 text-sm font-medium">Creator Account Active</p>
                <p className="text-green-400/70 text-xs">You can upload and sell your content.</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid: Profile + Contact */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left: Profile Info (2/3 on desktop) */}
          <div className="lg:col-span-2">
            {!isEditing && hasProfile ? (
              // VIEW MODE - Clean Cards
              <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5">
                  <div className="bg-[#1a1a1a] p-4 sm:p-5">
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">Full Name</p>
                    <p className="text-white text-base font-medium mt-1">{profile.full_name || 'Not set'}</p>
                  </div>
                  <div className="bg-[#1a1a1a] p-4 sm:p-5">
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">Creator Status</p>
                    <p className={`text-base font-medium mt-1 ${profile.is_creator ? 'text-green-400' : 'text-gray-500'}`}>
                      {profile.is_creator ? 'Active' : 'Not a creator'}
                    </p>
                  </div>
                  <div className="bg-[#1a1a1a] p-4 sm:p-5 sm:col-span-2">
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">Bio</p>
                    <p className="text-white text-sm mt-1">{profile.bio || 'Not set'}</p>
                  </div>
                  <div className="bg-[#1a1a1a] p-4 sm:p-5 sm:col-span-2">
                    <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">Payout Phone</p>
                    <p className="text-white font-mono text-sm mt-1">{profile.payout_phone || 'Not set'}</p>
                  </div>
                </div>

                <div className="p-4 sm:p-5 border-t border-white/5">
                  <button
                    onClick={handleEdit}
                    className="w-full bg-[#f5c518] text-black py-2.5 rounded-lg font-semibold hover:bg-[#e0b010] transition flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                </div>
              </div>
            ) : (
              // EDIT MODE - Form
              <form onSubmit={handleSubmit} className="bg-[#1a1a1a] rounded-xl border border-white/5 p-4 sm:p-6 space-y-4 sm:space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <span>✅</span> Profile saved successfully.
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={3}
                    className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm resize-none transition"
                    placeholder="Tell your audience about yourself..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Avatar URL</label>
                  <input
                    type="url"
                    value={profile.avatar_url}
                    onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                    className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <p className="text-gray-500 text-xs mt-1.5">URL to your profile picture</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Payout Phone <span className="text-gray-500">(M-Pesa)</span>
                  </label>
                  <input
                    type="text"
                    value={profile.payout_phone}
                    onChange={(e) => setProfile({ ...profile, payout_phone: e.target.value })}
                    className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                    placeholder="0712345678"
                  />
                  <p className="text-gray-500 text-xs mt-1.5">Used for payout requests</p>
                </div>

                <div className={`rounded-xl p-4 border transition ${
                  intent === 'creator' 
                    ? 'bg-[#f5c518]/10 border-[#f5c518]' 
                    : 'bg-[#0a0a0a] border-white/10'
                }`}>
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="is_creator"
                      checked={profile.is_creator}
                      onChange={(e) => setProfile({ ...profile, is_creator: e.target.checked })}
                      className="w-5 h-5 accent-[#f5c518] flex-shrink-0 rounded border-white/20"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-300">Become a Creator</p>
                      <p className="text-xs text-gray-500">Upload and sell your content to earn 85% of every sale</p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#f5c518] text-black py-3 rounded-xl font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-3 border border-white/20 rounded-xl font-semibold hover:bg-white/5 transition text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Contact + Logout Section (1/3 on desktop) */}
          <div className="lg:col-span-1 space-y-4">
            {/* Contact Card */}
            <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-5">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Contact Us</h3>
              
              <div className="space-y-3">
                {/* ✅ Email - CORRECT */}
                <a
                  href="mailto:reialproduction@gmail.com"
                  className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg hover:bg-white/5 transition group"
                >
                  <div className="w-9 h-9 rounded-full bg-[#f5c518]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#f5c518]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-white group-hover:text-[#f5c518] transition truncate">
                      reialproduction@gmail.com
                    </p>
                  </div>
                </a>

                {/* WhatsApp */}
                <a
                  href="https://wa.me/254704908255"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-[#0a0a0a] rounded-lg hover:bg-green-500/10 transition group"
                >
                  <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">WhatsApp</p>
                    <p className="text-sm text-white group-hover:text-green-400 transition">
                      Chat with us
                    </p>
                  </div>
                </a>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-medium transition flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/254704908255"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></div>
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

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <ProfileForm />
    </Suspense>
  )
}
