'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  const [profile, setProfile] = useState<Profile>({
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
        setProfile({
          full_name: data.full_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          is_creator: data.is_creator || false,
          payout_phone: data.payout_phone || '',
        })
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

    if (intent === 'creator' && currentProfile.is_creator && !wasCreator) {
      setTimeout(() => {
        router.push('/terms')
      }, 1000)
      return
    }

    setTimeout(() => setSuccess(false), 2000)
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">Manage your creator profile and settings.</p>

        {intent === 'creator' && !profile.is_creator && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-yellow-400 text-xs sm:text-sm">
              Check the box below to become a creator and start uploading content.
            </p>
          </div>
        )}

        {profile.is_creator && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
            <p className="text-green-400 text-xs sm:text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
              You are a creator
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
              Profile saved successfully.
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="mt-1 block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className="mt-1 block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base resize-none"
              placeholder="Tell your audience about yourself..."
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300">Avatar URL</label>
            <input
              type="url"
              value={profile.avatar_url}
              onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
              className="mt-1 block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
              placeholder="https://example.com/avatar.jpg"
            />
            <p className="text-gray-500 text-[10px] sm:text-xs mt-1">URL to your profile picture</p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300">
              Payout Phone <span className="text-gray-500">(M-Pesa)</span>
            </label>
            <input
              type="text"
              value={profile.payout_phone}
              onChange={(e) => setProfile({ ...profile, payout_phone: e.target.value })}
              className="mt-1 block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
              placeholder="0712345678"
            />
            <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Used for payout requests</p>
          </div>

          <div className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border ${
            intent === 'creator' 
              ? 'bg-[#f5c518]/10 border-[#f5c518]' 
              : 'bg-[#1a1a1a] border-white/10'
          }`}>
            <input
              type="checkbox"
              id="is_creator"
              checked={profile.is_creator}
              onChange={(e) => setProfile({ ...profile, is_creator: e.target.checked })}
              className="w-4 h-4 sm:w-5 sm:h-5 accent-[#f5c518] flex-shrink-0 rounded border-white/20"
            />
            <label htmlFor="is_creator" className="text-xs sm:text-sm font-medium text-gray-300 cursor-pointer select-none">
              Become a Creator
              <span className="block text-gray-500 text-[10px] sm:text-xs font-normal">Upload and sell your content</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#f5c518] text-black py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
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
