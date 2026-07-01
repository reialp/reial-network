'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TermsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }
      setUserId(session.user.id)
    }
    getUser()
  }, [supabase, router])

  const acceptTerms = async () => {
    if (!userId) {
      setError('Please log in first.')
      return
    }

    setLoading(true)
    setError(null)

    // ✅ Update profile
    const { error } = await supabase
      .from('profiles')
      .update({ 
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        is_creator: true
      })
      .eq('id', userId)

    if (error) {
      setError('Failed to accept terms: ' + error.message)
      setLoading(false)
      return
    }

    // ✅ Wait a moment for the database to update
    await new Promise(resolve => setTimeout(resolve, 500))

    // ✅ Force a full page redirect to upload
    window.location.href = '/upload'
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-white/10">
          <h1 className="text-3xl font-bold mb-6 text-center">Creator Terms & Conditions</h1>
          <p className="text-gray-400 text-center mb-8">
            Please read these terms carefully before uploading content to Reial Network.
          </p>

          {/* Terms content... */}

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

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
