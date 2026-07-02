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
  const [debug, setDebug] = useState<string>('')
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
      setDebug('🔄 Loading profile...')
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      setDebug(`✅ User ID: ${session.user.id}`)

      // ✅ Try to get existing profile
      const { data, error, status } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      // ✅ Log everything for debugging
      console.log('📊 Profile data:', data)
      console.log('📊 Profile error:', error)
      console.log('📊 Status code:', status)

      // ✅ If profile doesn't exist (status 406 or error code PGRST116)
      if (error) {
        setDebug(`❌ Error loading: ${error.message} (code: ${error.code})`)
        
        // ✅ Create profile if it doesn't exist
        if (error.code === 'PGRST116' || status === 406) {
          setDebug('🔄 Creating profile...')
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || '',
              is_creator: false,
              terms_accepted: false,
            })
            .select()
            .single()

          if (insertError) {
            setDebug(`❌ Insert error: ${insertError.message}`)
            setError('Failed to create profile: ' + insertError.message)
            setLoading(false)
            return
          }

          setDebug(`✅ Profile created! ID: ${newProfile?.id}`)
          setProfileId(newProfile?.id || null)
          
          // ✅ Set the profile data from the new profile
          if (newProfile) {
            setProfile({
              full_name: newProfile.full_name || '',
              bio: newProfile.bio || '',
              avatar_url: newProfile.avatar_url || '',
              is_creator: newProfile.is_creator || false,
              payout_phone: newProfile.payout_phone || '',
            })
          }
          setLoading(false)
          return
        }

        setError('Failed to load profile: ' + error.message)
        setLoading(false)
        return
      }

      // ✅ Profile exists, load it
      if (data) {
        setDebug(`✅ Profile loaded: ${data.full_name || 'No name'} (ID: ${data.id})`)
        setProfileId(data.id)
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
    setDebug('🔄 Saving profile...')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Not authenticated')
      setSaving(false)
      return
    }

    // ✅ Update profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        is_creator: profile.is_creator,
        payout_phone: profile.payout_phone,
      })
      .eq('id', session.user.id)
      .select()

    if (error) {
      setDebug(`❌ Update error: ${error.message}`)
      setError('Failed to save: ' + error.message)
      setSaving(false)
      return
    }

    setDebug(`✅ Profile saved! ${JSON.stringify(data)}`)
    setSuccess(true)
    setSaving(false)

    // ✅ Refresh the router to update Navbar state
    router.refresh()

    // ✅ If they checked is_creator and came from creator intent, go to terms
    if (intent === 'creator' && profile.is_creator) {
      setTimeout(() => router.push('/terms'), 1500)
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

        {/* Debug info */}
        {debug && (
          <div className="bg-[#0a0a0a] rounded-xl p-3 mb-4 border border-white/10">
            <p className="text-xs text-gray-400">🔍 Debug: <span className="text-[#f5c518]">{debug}</span></p>
          </div>
        )}

        {profileId && (
          <div className="bg-[#0a0a0a] rounded-xl p-2 mb-4 border border-green-500/20">
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
