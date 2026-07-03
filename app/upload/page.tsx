'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [checkingAccess, setCheckingAccess] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [posterPreview, setPosterPreview] = useState<string>('')
  const [existingPosterUrl, setExistingPosterUrl] = useState<string>('')
  const [videoUrl, setVideoUrl] = useState('')
  const [trailerUrl, setTrailerUrl] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [releaseYear, setReleaseYear] = useState<number | ''>('')
  const [language, setLanguage] = useState('')
  const [subtitles, setSubtitles] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)

  // Check access
  useEffect(() => {
    const checkAccess = async () => {
      setCheckingAccess(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login?redirectTo=/upload')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('terms_accepted, is_creator')
        .eq('id', session.user.id)
        .single()

      if (!profile) {
        router.push('/profile')
        return
      }

      if (!profile.is_creator) {
        router.push('/profile?intent=creator')
        return
      }

      if (!profile.terms_accepted) {
        router.push('/terms')
        return
      }
      setCheckingAccess(false)
    }
    checkAccess()
  }, [router, supabase])

  const uploadPoster = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = `posters/${fileName}`

      const { error } = await supabase.storage
        .from('content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('content')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPosterFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPosterPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePoster = () => {
    setPosterFile(null)
    setPosterPreview('')
    setExistingPosterUrl('')
  }

  const handleSubmit = async (status: 'draft' | 'pending') => {
    if (!rightsConfirmed) {
      setError('You must confirm you have the rights to distribute this content.')
      return
    }

    if (!title.trim() || !videoUrl.trim() || !price || !category) {
      setError('Please fill in all required fields (Title, Video Link, Price, Category).')
      return
    }

    setLoading(true)
    setError(null)
    setUploadProgress(0)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('You must be logged in.')
      setLoading(false)
      return
    }

    try {
      setUploadProgress(30)
      let posterUrl = existingPosterUrl
      
      if (posterFile) {
        const url = await uploadPoster(posterFile)
        if (url) {
          posterUrl = url
        } else {
          setError('Failed to upload poster. Please try again.')
          setLoading(false)
          return
        }
      }

      setUploadProgress(70)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        thumbnail_url: posterUrl || null,
        video_url: videoUrl.trim(),
        trailer_url: trailerUrl.trim() || null,
        category,
        price: Number(price),
        release_year: releaseYear ? Number(releaseYear) : null,
        language: language.trim() || null,
        subtitles: subtitles.trim() || null,
        status,
        rights_confirmed_at: new Date().toISOString(),
        creator_id: session.user.id,
      }

      const { error: insertError } = await supabase
        .from('content')
        .insert([payload])

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      setUploadProgress(100)
      setSuccess(true)
      setLoading(false)
      
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (error: any) {
      console.error('Upload error:', error)
      setError('Upload failed: ' + error.message)
      setLoading(false)
    }
  }

  // Loading state while checking access
  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm sm:text-base">Checking access...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] rounded-2xl p-6 sm:p-8 max-w-md w-full text-center border border-white/10">
          <div className="text-5xl sm:text-6xl mb-4">✅</div>
          <h2 className="text-xl sm:text-2xl font-bold">Upload Successful!</h2>
          <p className="text-gray-400 text-sm sm:text-base mt-2">Your project has been submitted for approval.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-5 sm:mt-6 bg-[#f5c518] text-black px-5 sm:px-6 py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition text-sm sm:text-base"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Upload New Project</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Share your story with the world.</p>
        </div>

        <form className="space-y-4 sm:space-y-6 md:space-y-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* Project Details */}
          <section className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/5">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Project Details</h2>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                  placeholder="e.g. The Last River"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 resize-none text-sm sm:text-base"
                  placeholder="Tell viewers what your project is about..."
                />
              </div>
            </div>
          </section>

          {/* Media Section */}
          <section className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/5">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Media</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">
                  Poster Image <span className="text-red-400">*</span>
                </label>
                
                {(posterPreview || existingPosterUrl) && (
                  <div className="mt-2 relative">
                    <img 
                      src={posterPreview || existingPosterUrl} 
                      alt="Poster preview" 
                      className="w-full h-auto max-h-48 object-cover rounded-lg border border-white/10" 
                    />
                    <button
                      type="button"
                      onClick={handleRemovePoster}
                      className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-full transition"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="mt-1 flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 sm:h-32 border-2 border-white/10 border-dashed rounded-lg cursor-pointer bg-[#0a0a0a] hover:bg-[#1a1a1a] transition">
                    <div className="flex flex-col items-center justify-center pt-3 sm:pt-5 pb-3 sm:pb-6 px-2">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs sm:text-sm text-gray-400 text-center">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">PNG, JPG, GIF (Max 5MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePosterChange}
                    />
                  </label>
                </div>
                
                <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-400">
                  <p className="text-gray-500">Upload a poster image for your project.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">
                  Video Link <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                  placeholder="Paste your YouTube or Vimeo link"
                />
                <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-400 space-y-0.5">
                  <p className="text-gray-500">1. Upload to YouTube or Vimeo</p>
                  <p className="text-gray-500">2. Set to "Unlisted"</p>
                  <p className="text-gray-500">3. Copy and paste the share link</p>
                  <p className="text-red-400/80 text-[10px] mt-1">⚠️ No age-restricted videos</p>
                </div>
              </div>
            </div>

            <div className="mt-3 sm:mt-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-300">Trailer Link (optional)</label>
              <input
                type="url"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                placeholder="Paste your trailer share link"
              />
            </div>
          </section>

          {/* Pricing & Metadata */}
          <section className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/5">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Pricing & Metadata</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white text-sm sm:text-base"
                >
                  <option value="">Select category</option>
                  <option value="Film">Film</option>
                  <option value="Documentary">Documentary</option>
                  <option value="Series">Series</option>
                  <option value="Short Film">Short Film</option>
                  <option value="Music">Music</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">
                  Price (KES) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                  placeholder="e.g. 300"
                  min="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">Release Year</label>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                  placeholder="2024"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                  placeholder="e.g. Swahili"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-300">Subtitles</label>
                <input
                  type="text"
                  value={subtitles}
                  onChange={(e) => setSubtitles(e.target.value)}
                  className="mt-1 block w-full px-3 sm:px-4 py-2 sm:py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm sm:text-base"
                  placeholder="e.g. English"
                />
              </div>
            </div>
          </section>

          {/* Rights Confirmation */}
          <section className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/5">
            <div className="flex items-start gap-2 sm:gap-3">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 accent-[#f5c518] flex-shrink-0"
                required
              />
              <label className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                I confirm that I own the rights to distribute this content and it does not infringe on any copyrights.
                <span className="text-red-400 ml-1">*</span>
              </label>
            </div>
          </section>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={loading}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/5 transition disabled:opacity-50 text-sm sm:text-base order-2 sm:order-1"
            >
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('pending')}
              disabled={loading}
              className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-[#f5c518] text-black rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base order-1 sm:order-2"
            >
              {loading ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2">
            Submitting for approval will notify the admin to review your project.
          </p>
        </form>
      </div>
    </div>
  )
}
