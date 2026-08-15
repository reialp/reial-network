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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Creator Agreement</h1>
          <p className="text-gray-400 text-center text-sm sm:text-base mb-6">
            Please read this entire agreement before uploading content to Cheki.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 text-gray-300 text-xs sm:text-sm leading-relaxed">
            {/* 1. Definitions */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">1. Definitions</h2>
              <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4">
                <li><span className="font-medium text-white">Cheki</span> – the content marketplace operated by Reial Production.</li>
                <li><span className="font-medium text-white">Creator</span> – you, the user uploading content.</li>
                <li><span className="font-medium text-white">Content</span> – any video, audio, image, or text file uploaded by the Creator.</li>
                <li><span className="font-medium text-white">Sale</span> – a transaction where a user purchases access to your Content.</li>
                <li><span className="font-medium text-white">Platform</span> – the Cheki website and associated services.</li>
              </ul>
            </div>

            {/* 2. Grant of Rights */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">2. Grant of Rights</h2>
              <p>By uploading Content, you grant Cheki a non‑exclusive, worldwide, royalty‑free license to host, store, display, and distribute your Content on the Platform for the purpose of facilitating sales and streaming. This license ends when you remove your Content or terminate your account.</p>
            </div>

            {/* 3. Revenue Share */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">3. Revenue Share</h2>
              <p>For each Sale, you earn <span className="text-[#f5c518] font-bold">70%</span> of the total price. Cheki retains <span className="text-yellow-400 font-bold">30%</span> to cover platform costs and services. Payouts are made upon your request once your balance reaches a minimum threshold.</p>
            </div>

            {/* 4. Representations and Warranties */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">4. Creator Representations</h2>
              <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4">
                <li>You own or have secured all necessary rights to the Content.</li>
                <li>You have the legal capacity to enter into this agreement.</li>
                <li>Your Content does not infringe on any third‑party rights.</li>
                <li>You will comply with all applicable laws and regulations.</li>
              </ul>
            </div>

            {/* 5. Prohibited Content */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">5. Prohibited Content</h2>
              <p>You may not upload Content that is:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 sm:ml-4 mt-1">
                <li>Illegal, defamatory, or fraudulent.</li>
                <li>Hateful, discriminatory, or harassing.</li>
                <li>Infringing on copyright, trademark, or other intellectual property.</li>
                <li>Explicitly pornographic or containing real‑world violence.</li>
              </ul>
            </div>

            {/* 6. Termination */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">6. Termination</h2>
              <p>Either party may terminate this agreement at any time. Upon termination, Cheki will remove your Content from public view within a reasonable time. You will continue to receive any outstanding revenue from Sales that occurred prior to termination.</p>
            </div>

            {/* 7. Limitation of Liability */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">7. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, Cheki shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform or the sale of your Content. Our total liability shall not exceed the total Revenue Share paid to you in the preceding six months.</p>
            </div>

            {/* 8. Indemnification */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">8. Indemnification</h2>
              <p>You agree to indemnify and hold Cheki harmless from any claims, losses, or damages arising from your breach of this agreement or your violation of any law or third‑party rights.</p>
            </div>

            {/* 9. Governing Law */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">9. Governing Law</h2>
              <p>This agreement is governed by the laws of Kenya. Any disputes shall be resolved exclusively in the courts of Nairobi, Kenya.</p>
            </div>

            {/* 10. Entire Agreement */}
            <div className="bg-[#0a0a0a] rounded-xl p-4 sm:p-6 border border-white/5">
              <h2 className="text-base sm:text-lg font-semibold text-[#f5c518] mb-2 sm:mb-3">10. Entire Agreement</h2>
              <p>This agreement constitutes the entire understanding between you and Cheki and supersedes all prior representations. If any provision is found invalid, the remaining provisions remain in full force.</p>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={acceptTerms}
              disabled={loading}
              className="flex-1 bg-[#f5c518] text-black py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base"
            >
              {loading ? 'Accepting...' : 'I Accept'}
            </button>
            <Link
              href="/dashboard"
              className="flex-1 border border-white/20 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-white/5 transition text-center text-sm sm:text-base"
            >
              Decline
            </Link>
          </div>

          {/* Brand credit */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] sm:text-xs text-gray-500 tracking-wider uppercase">
              <span className="text-gray-400 font-medium">Cheki</span> – powered by <span className="text-[#f5c518]">Reial Production</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
