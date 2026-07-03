'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const intent = searchParams?.get('intent')
  const redirectTo = searchParams?.get('redirectTo')

  const getFinalRedirect = () => {
    if (intent === 'creator') {
      return '/profile?intent=creator'
    }
    if (redirectTo) return redirectTo
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
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl sm:text-6xl mb-4">📧</div>
          <h2 className="text-xl sm:text-2xl font-bold">Check your email</h2>
          <p className="text-gray-400 text-sm sm:text-base mt-2">
            We sent a confirmation link to <strong className="text-white">{email}</strong>.
          </p>
          <p className="text-yellow-400/80 text-xs sm:text-sm mt-3 bg-[#1a1a1a] p-3 rounded-lg border border-yellow-500/20">
            Please check your <strong>inbox</strong> or <strong>spam/junk</strong> folder.
          </p>
          <Link
            href={`/auth/login?redirectTo=${encodeURIComponent(finalRedirect)}${intent ? `&intent=${intent}` : ''}`}
            className="mt-6 inline-block text-[#f5c518] hover:underline text-sm sm:text-base"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="inline-block">
            <h1 className="text-3xl sm:text-4xl font-bold">
              Reial<span className="text-[#f5c518]">.</span>
            </h1>
            <div className="h-0.5 w-8 mx-auto mt-1 bg-[#f5c518]/50 rounded-full" />
          </div>
          <h2 className="mt-4 sm:mt-6 text-xl sm:text-2xl font-semibold">Create your account</h2>
          <p className="mt-2 text-gray-400 text-xs sm:text-sm">
            {redirectTo ? (
              <span>Complete your purchase by signing up</span>
            ) : intent === 'creator' ? (
              <span>Start your creator journey</span>
            ) : (
              'Join the community'
            )}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-xs sm:text-sm font-medium text-gray-300">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base transition"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-300">
              Email address <span className="text-red-400">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-gray-300">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 pr-10 sm:pr-12 text-sm sm:text-base transition"
                placeholder="Create a password"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                {showPassword ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Must be at least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-black bg-[#f5c518] hover:bg-[#e0b010] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f5c518] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {/* Sign in link */}
        <div className="text-center">
          <p className="text-gray-400 text-xs sm:text-sm">
            Already have an account?{' '}
            <Link
              href={`/auth/login?redirectTo=${encodeURIComponent(finalRedirect)}${intent ? `&intent=${intent}` : ''}`}
              className="text-[#f5c518] hover:underline font-medium transition"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
