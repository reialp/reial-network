'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function TermsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function getUserId() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
      } else {
        router.push('/auth/login')
      }
    }
    getUserId()
  }, [supabase, router])

  const acceptTerms = async () => {
    if (!userId) {
      setError('Please log in first.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // ✅ Only update terms_accepted, keep is_creator as true (already set)
      const { error } = await supabase
        .from('profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) {
        console.error('❌ Update error:', error)
        setError('Failed to accept terms: ' + error.message)
        setLoading(false)
        return
      }

      console.log('✅ Terms accepted')
      router.push('/dashboard')

    } catch (err: any) {
      console.error('❌ Error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-white/10">
          <h1 className="text-3xl font-bold mb-6 text-center">Creator Terms & Conditions</h1>
          <p className="text-gray-400 text-center mb-8">
            Please read these terms carefully before uploading content to Reial Network.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">1. Ownership of Content</h2>
              <p>You retain full ownership of all content you upload to Reial Network.</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">2. Revenue Share</h2>
              <p>You earn <span className="text-[#f5c518] font-bold">85%</span> of all sales revenue. Reial Network retains <span className="text-yellow-400 font-bold">15%</span>.</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">3. Content Guidelines</h2>
              <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
                <li>Content must be original or properly licensed</li>
                <li>Content must comply with all applicable laws</li>
                <li>Content must not contain hate speech or illegal material</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              onClick={acceptTerms}
              disabled={loading}
              className="flex-1 bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
            >
              {loading ? 'Accepting...' : 'I Agree to the Terms & Conditions'}
            </button>
            <Link
              href="/dashboard"
              className="flex-1 border border-white/20 py-3 rounded-lg font-semibold hover:bg-white/5 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
