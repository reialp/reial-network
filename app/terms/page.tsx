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
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkTerms() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/auth/login')
        return
      }

      setUserId(session.user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('terms_accepted')
        .eq('id', session.user.id)
        .single()

      setChecking(false)

      if (profile?.terms_accepted === true) {
        window.location.href = '/dashboard'
        return
      }
    }
    checkTerms()
  }, [router, supabase])

  const acceptTerms = async () => {
    if (!userId) {
      setError('Please log in first.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (updateError) {
        setError('Failed to save: ' + updateError.message)
        setLoading(false)
        return
      }

      window.location.href = '/dashboard'

    } catch (err: any) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-white/10">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">Creator Terms</h1>
          <p className="text-gray-400 text-center text-sm sm:text-base mb-6 sm:mb-8">
            Please read these terms before uploading content.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 text-gray-300 text-xs sm:text-sm leading-relaxed">
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">Content Ownership</h2>
              <p>You retain full ownership of all content you upload.</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">Revenue Share</h2>
              <p>You earn <span className="text-[#f5c518] font-bold">85%</span> of all sales. Reial Network retains <span className="text-yellow-400 font-bold">15%</span>.</p>
            </div>
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">Content Guidelines</h2>
              <ul className="list-disc list-inside mt-2 space-y-1 sm:space-y-2 ml-2 sm:ml-4">
                <li>Content must be original or properly licensed</li>
                <li>Content must comply with all applicable laws</li>
                <li>Content must not contain hate speech or illegal material</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={acceptTerms}
              disabled={loading}
              className="flex-1 bg-[#f5c518] text-black py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base"
            >
              {loading ? 'Accepting...' : 'I Agree'}
            </button>
            <Link
              href="/dashboard"
              className="flex-1 border border-white/20 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-white/5 transition text-center text-sm sm:text-base"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
