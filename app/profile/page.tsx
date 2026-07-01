'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const intent = searchParams?.get('intent')

  const [profile, setProfile] = useState({
    full_name: '',
    bio: '',
    avatar_url: '',
    is_creator: false,
    payout_phone: '',
  })

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setProfile({
          full_name: data.full_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          is_creator: data.is_creator || false,
          payout_phone: data.payout_phone || '',
        })
      }
    }
    loadProfile()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        is_creator: profile.is_creator,
        payout_phone: profile.payout_phone,
      })
      .eq('id', session.user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
              Profile updated successfully!
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
            <label className="block text-sm font-medium text-gray-300">M-Pesa Phone (for payouts)</label>
            <input
              type="text"
              value={profile.payout_phone}
              onChange={(e) => setProfile({ ...profile, payout_phone: e.target.value })}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="e.g. 0712345678"
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
              {intent === 'creator' && <span className="block text-xs text-[#f5c518] mt-1">Check this to enable uploads</span>}
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}
