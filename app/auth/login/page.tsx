'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // ✅ Get the redirect URL from the query string
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // ✅ Use window.location for reliable redirect to the intended page
    console.log('🔀 Redirecting to:', redirectTo)
    window.location.href = redirectTo
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.')
      return
    }
    setLoading(true)
    setError(null)
    setResetMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setResetMessage('✅ Password reset email sent! Check your inbox.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-center">
            Reial<span className="text-[#f5c518]">.</span>
          </h1>
          <h2 className="mt-6 text-2xl font-semibold text-center">Sign in to your account</h2>
          <p className="mt-2 text-center text-gray-400">
            Welcome back to the Reial Network
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}
          {resetMessage && (
            <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded text-sm">
              {resetMessage}
            </div>
          )}
          
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-800 bg-[#1a1a1a] placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-[#f5c518] focus:border-transparent transition-all sm:text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-800 bg-[#1a1a1a] placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-[#f5c518] focus:border-transparent transition-all sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-300"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-[#f5c518] focus:ring-[#f5c518] border-gray-800 rounded bg-[#1a1a1a]"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                Remember me
              </label>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-medium text-[#f5c518] hover:text-[#e5b518]"
            >
              Forgot password?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-black bg-[#f5c518] hover:bg-[#e5b518] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f5c518] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-[#f5c518] hover:text-[#e5b518]">
            Sign up now
          </Link>
        </p>
      </div>
    </div>
  )
}
