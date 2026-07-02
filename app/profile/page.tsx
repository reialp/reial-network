'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  full_name: string
  bio: string
  avatar_url: string
  is_creator: boolean
  payout_phone: string
}

export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const intent = searchParams.get('intent')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)

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

      console.log('🔍 Loading profile for user:', session.user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        console.log('🔄 Creating new profile for user:', session.user.id)
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || '',
            is_creator: false,
            terms_accepted: false,
          })

        if (!insertError) {
          console.log('✅ Profile created, reloading...')
          loadProfile()
          return
        } else {
          console.error('❌ Failed to create profile:', insertError)
          setError('Failed to create profile. Please try again.')
          setLoading(false)
          return
        }
      }

      if (data) {
        console.log('📊 Profile loaded:', data)
        setProfile({
          full_name: data.full_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          is_creator: data.is_creator || false,
          payout_phone: data.payout_phone || '',
        })
        setProfileId(data.id)
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Not authenticated')
      setSaving(false)
      return
    }

    // ✅ Save the current state BEFORE update
    const wasCreator = profile.is_creator
    const userId = session.user.id

    console.log('📝 Attempting to update profile for user:', userId)
    console.log('📝 Data to update:', {
      full_name: profile.full_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      is_creator: profile.is_creator,
      payout_phone: profile.payout_phone,
    })

    // ✅ First, verify the profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('id, is_creator')
      .eq('id', userId)
      .single()

    if (checkError || !existingProfile) {
      console.error('❌ Profile not found:', checkError)
      setError('Profile not found. Please try again.')
      setSaving(false)
      return
    }

    console.log('✅ Profile found, ID:', existingProfile.id)

    // ✅ Perform the update
    const { data: updatedData, error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        is_creator: profile.is_creator,
        payout_phone: profile.payout_phone,
      })
      .eq('id', userId)
      .select()  // ✅ IMPORTANT: Return the updated data

    if (updateError) {
      console.error('❌ Update error:', updateError)
      setError('Failed to save: ' + updateError.message)
      setSaving(false)
      return
    }

    // ✅ CRITICAL: Verify the update actually happened
    if (!updatedData || updatedData.length === 0) {
      console.error('❌ No rows were updated!')
      setError('Failed to save profile. No rows were updated.')
      setSaving(false)
      return
    }

    // ✅ Verify the update worked by fetching fresh data
    const { data: verifyData, error: verifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (verifyError) {
      console.error('❌ Verification error:', verifyError)
      setError('Profile saved but verification failed. Please refresh.')
      setSaving(false)
      return
    }

    console.log('✅ Verified updated profile:', verifyData)

    // ✅ Update local state with verified data
    if (verifyData) {
      setProfile({
        full_name: verifyData.full_name || '',
        bio: verifyData.bio || '',
        avatar_url: verifyData.avatar_url || '',
        is_creator: verifyData.is_creator || false,
        payout_phone: verifyData.payout_phone || '',
      })
      setProfileId(verifyData.id)
    }

    setSuccess(true)
    setSaving(false)

    // ✅ Refresh the router to update Navbar state
    router.refresh()

    // ✅ User CHOSE to become a creator - redirect to terms
    if (intent === 'creator' && profile.is_creator && !wasCreator) {
      console.log('🚀 User became a creator! Redirecting to terms...')
      setTimeout(() => {
        router.push('/terms')
      }, 1500)
    } else if (intent === 'creator' && !profile.is_creator) {
      console.log('ℹ️ User is not a creator, staying on profile')
      setTimeout(() => setSuccess(false), 3000)
    } else {
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

        {profileId && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 mb-4">
            <p className="text-xs text-green-400">✅ Profile ID: {profileId}</p>
          </div>
        )}

        {intent === 'creator' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 text-sm">
              🚀 To become a creator, check the box below and save your profile.
              {profile.is_creator && <span className="block text-green-400 mt-1">✅ You are already a creator!</span>}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
              ✅ Profile updated! {intent === 'creator' && profile.is_creator && 'Redirecting to terms...'}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300">Full Name</label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              rows={3}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Avatar URL</label>
            <input
              type="url"
              value={profile.avatar_url}
              onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">M-Pesa Phone</label>
            <input
              type="text"
              value={profile.payout_phone}
              onChange={(e) => setProfile({ ...profile, payout_phone: e.target.value })}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="0712345678"
            />
          </div>

          <div className={`flex items-center gap-3 p-4 rounded-lg border ${intent === 'creator' ? 'bg-[#f5c518]/10 border-[#f5c518]' : 'bg-[#1a1a1a] border-white/10'}`}>
            <input
              type="checkbox"
              id="is_creator"
              checked={profile.is_creator}
              onChange={(e) => setProfile({ ...profile, is_creator: e.target.checked })}
              className="w-5 h-5 accent-[#f5c518]"
            />
            <label htmlFor="is_creator" className="text-sm font-medium text-gray-300 cursor-pointer">
              Become a Creator (upload and sell content)
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
