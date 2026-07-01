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

    try {
      // ✅ Update profile
      const { data, error } = await supabase
        .from('profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          is_creator: true
        })
        .eq('id', userId)
        .select()

      if (error) {
        console.error('Update error:', error)
        setError('Failed to accept terms: ' + error.message)
        setLoading(false)
        return
      }

      console.log('✅ Profile updated:', data)

      // ✅ Redirect to upload
      window.location.href = '/upload'

    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-white/10">
          <h1 className="text-3xl font-bold mb-6 text-center">Creator Terms & Conditions</h1>
          <p className="text-gray-400 text-center mb-8">
            Please read these terms carefully before uploading content to Reial Network.
          </p>

          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">1. Ownership of Content</h2>
              <p>
                You retain full ownership of all content you upload to Reial Network.
                By uploading, you grant Reial Network a non-exclusive license to host,
                display, and distribute your content on our platform.
              </p>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">2. Rights and Permissions</h2>
              <p>You confirm and guarantee that:</p>
              <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
                <li>You own or have obtained all necessary rights to the content you upload</li>
                <li>Your content does not infringe on any third-party copyrights, trademarks, or other intellectual property rights</li>
                <li>You have permission from all individuals appearing in your content</li>
                <li>Your content does not contain defamatory, obscene, or illegal material</li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">3. Revenue Share</h2>
              <p>
                You will earn <span className="text-[#f5c518] font-bold">85%</span> of all sales revenue generated from your content.
                Reial Network retains <span className="text-yellow-400 font-bold">15%</span> as a platform fee for hosting,
                payment processing, and distribution services.
              </p>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">4. Content Guidelines</h2>
              <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
                <li>Content must be original or properly licensed</li>
                <li>Content must comply with all applicable laws</li>
                <li>Content must not contain hate speech, harassment, or discrimination</li>
                <li>Content must not contain graphic violence or explicit material</li>
                <li>AI-generated content must be clearly labeled</li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">5. Monetization Terms</h2>
              <ul className="list-disc list-inside mt-2 space-y-2 ml-4">
                <li>All sales are final and non-refundable</li>
                <li>Reial Network handles all payment processing</li>
                <li>Payouts are processed once you reach the minimum threshold of KES 500</li>
                <li>Payouts are processed within 1-3 business days of request</li>
              </ul>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">6. Termination</h2>
              <p>
                Reial Network reserves the right to remove any content that violates these terms.
                You may request to remove your content at any time, subject to any existing sales.
              </p>
            </div>

            <div className="bg-[#0a0a0a] rounded-xl p-6 border border-white/5">
              <h2 className="text-lg font-semibold text-[#f5c518] mb-3">7. Liability</h2>
              <p>
                You agree to hold Reial Network harmless from any claims arising from your content.
                You are solely responsible for the content you upload and its legality.
              </p>
            </div>
          </div>

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
          <p className="text-xs text-gray-500 text-center mt-4">
            By clicking "I Agree", you accept all terms and conditions stated above.
          </p>
        </div>
      </div>
    </div>
  )
}
