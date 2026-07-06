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
        
        // ✅ If profile is empty, auto-enter edit mode
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-10">
        
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

        {/* View Mode */}
        {!isEditing && hasProfile ? (
          <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5 space-y-4">
            {/* Full Name */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-gray-400 text-sm">Full Name</span>
              <span className="text-white font-medium">{profile.full_name || 'Not set'}</span>
            </div>
            {/* Bio */}
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <span className="text-gray-400 text-sm">Bio</span>
              <span className="text-white text-sm text-right max-w-[60%]">{profile.bio || 'Not set'}</span>
            </div>
            {/* Avatar URL */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-gray-400 text-sm">Avatar</span>
              <span className="text-white text-sm truncate max-w-[60%]">{profile.avatar_url ? 'Set ✅' : 'Not set'}</span>
            </div>
            {/* Payout Phone */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <span className="text-gray-400 text-sm">Payout Phone</span>
              <span className="text-white font-mono text-sm">{profile.payout_phone || 'Not set'}</span>
            </div>
            {/* Creator Status */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-400 text-sm">Creator Status</span>
              <span className={`text-sm font-medium ${profile.is_creator ? 'text-green-400' : 'text-gray-500'}`}>
                {profile.is_creator ? '✅ Active' : 'Not a creator'}
              </span>
            </div>

            {/* Edit button at bottom */}
            <button
              onClick={handleEdit}
              className="w-full mt-2 bg-[#f5c518] text-black py-2.5 rounded-lg font-semibold hover:bg-[#e0b010] transition flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </button>
          </div>
        ) : (
          /* Edit Mode - Form */
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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

            <div className="bg-[#1a1a1a] rounded-xl p-4 sm:p-5 border border-white/5 space-y-4 sm:space-y-5">
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
            </div>

            {/* Creator Checkbox - Card Style */}
            <div className={`rounded-xl p-4 sm:p-5 border transition ${
              intent === 'creator' 
                ? 'bg-[#f5c518]/10 border-[#f5c518] hover:border-[#f5c518]/60' 
                : 'bg-[#1a1a1a] border-white/5 hover:border-white/20'
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

            {/* Form Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
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
