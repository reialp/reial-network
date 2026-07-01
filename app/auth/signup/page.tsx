'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // ✅ Get intent and redirectTo parameters
  const intent = searchParams.get('intent') // 'creator' or null
  const redirectTo = searchParams.get('redirectTo')

  // ✅ Determine final redirect destination
  const getFinalRedirect = () => {
    // Priority 1: If they came from a purchase flow, go back to checkout
    if (redirectTo) return redirectTo
    // Priority 2: If they clicked "Become a Creator", go to profile/creator setup
    if (intent === 'creator') return '/profile'
    // Priority 3: Default to home
    return '/'
  }

  const finalRedirect = getFinalRedirect()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
      callbackUrl.searchParams.set('redirectTo', finalRedirect)
      if (intent) {
        callbackUrl.searchParams.set('intent', intent)
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: callbackUrl.toString(),
        },
      })

      if (error) {
        console.error('Signup error:', error)

        let friendlyMessage = 'Something went wrong. Please try again.'

        if (error.message.includes('already registered')) {
          friendlyMessage = 'This email is already registered. Please sign in instead.'
        } else if (error.message.toLowerCase().includes('password')) {
          friendlyMessage = 'Password must be at least 6 characters.'
        } else if (error.message.toLowerCase().includes('email')) {
          friendlyMessage = 'Please enter a valid email address.'
        } else if (error.status === 422) {
          friendlyMessage = 'Invalid email format. Please check and try again.'
        }

        setError(friendlyMessage)
        setLoading(false)
        return
      }

      if (data?.user) {
        setSuccess(true)
      }
    } catch (err: any) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-4">📧</div>
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-gray-400 mt-2">
            We sent a confirmation link to <strong className="text-white">{email}</strong>.
          </p>
          <p className="text-yellow-400/80 text-sm mt-3 bg-[#1a1a1a] p-3 rounded-lg border border-yellow-500/20">
            📌 Please check your <strong>inbox</strong> or <strong>spam/junk</strong> folder.
          </p>
          <Link
            href={`/auth/login?redirectTo=${encodeURIComponent(finalRedirect)}${intent ? `&intent=${intent}` : ''}`}
            className="mt-6 inline-block text-[#f5c518] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">
            Reial<span className="text-[#f5c518]">.</span>
          </h1>
          <h2 className="mt-6 text-2xl font-semibold">Create your account</h2>
          <p className="mt-2 text-gray-400 text-sm">
            {redirectTo ? (
              <span className="text-[#f5c518]">🔐 Complete your purchase by signing up</span>
            ) : intent === 'creator' ? (
              <span className="text-[#f5c518]">🎬 Create your creator account</span>
            ) : (
              <>
                Already have an account?{' '}
                <Link href={`/auth/login?redirectTo=${encodeURIComponent(finalRedirect)}${intent ? `&intent=${intent}` : ''}`} className="text-[#f5c518] hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-300">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 pr-12"
                placeholder="••••••••"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-black bg-[#f5c518] hover:bg-[#e0b010] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f5c518] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
