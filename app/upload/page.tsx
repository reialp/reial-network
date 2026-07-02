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

  // Form fields
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

  // ✅ FIX #3: Check if user is a creator AND has accepted terms
  useEffect(() => {
    const checkCreatorStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login?redirectTo=/upload')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_creator, terms_accepted')
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        router.push('/profile?intent=creator')
        return
      }

      // ✅ If not a creator, redirect to profile to become one
      if (!profile.is_creator) {
        router.push('/profile?intent=creator')
        return
      }

      // ✅ If creator but hasn't accepted terms, redirect to terms
      if (!profile.terms_accepted) {
        router.push('/terms')
        return
      }

      // ✅ All checks passed, user can upload
    }
    checkCreatorStatus()
  }, [router, supabase])

  // Upload poster to Supabase Storage
  const uploadPoster = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = `posters/${fileName}`

      const { data, error } = await supabase.storage
        .from('content')
        .upload(filePath, file)

      if (error) throw error
      return data.path
    } catch (err) {
      console.error('Poster upload error:', err)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    if (!title || !description || !videoUrl || !category || !price) {
      setError('Please fill in all required fields.')
      setLoading(false)
      return
    }

    if (!rightsConfirmed) {
      setError('You must confirm that you have the rights to this content.')
      setLoading(false)
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated.')
        setLoading(false)
        return
      }

      let posterPath = existingPosterUrl

      if (posterFile) {
        setUploadProgress(25)
        posterPath = await uploadPoster(posterFile)
        if (!posterPath) {
          setError('Failed to upload poster.')
          setLoading(false)
          return
        }
      }

      setUploadProgress(50)

      const { data, error: insertError } = await supabase
        .from('content')
        .insert({
          creator_id: session.user.id,
          title,
          description,
          poster_url: posterPath,
          video_url: videoUrl,
          trailer_url: trailerUrl,
          category,
          price: parseInt(price.toString()),
          release_year: releaseYear ? parseInt(releaseYear.toString()) : null,
          language,
          subtitles,
          status: 'pending',
        })
        .select()

      if (insertError) {
        setError('Failed to upload content: ' + insertError.message)
        setLoading(false)
        return
      }

      setUploadProgress(100)
      setSuccess(true)
      setTitle('')
      setDescription('')
      setPosterFile(null)
      setPosterPreview('')
      setVideoUrl('')
      setTrailerUrl('')
      setCategory('')
      setPrice('')
      setReleaseYear('')
      setLanguage('')
      setSubtitles('')
      setRightsConfirmed(false)

      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError('Error: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Upload Content</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
              ✅ Content uploaded successfully! Redirecting to dashboard...
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="Film title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white resize-none"
              placeholder="Describe your film..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Poster Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePosterChange}
              className="mt-1 block w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#f5c518] file:text-black hover:file:bg-[#e0b010]"
            />
            {posterPreview && (
              <img src={posterPreview} alt="Poster preview" className="mt-4 w-32 h-48 object-cover rounded-lg" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Video URL *</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="https://example.com/video.mp4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Trailer URL</label>
            <input
              type="url"
              value={trailerUrl}
              onChange={(e) => setTrailerUrl(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="https://example.com/trailer.mp4"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              >
                <option value="">Select category</option>
                <option value="action">Action</option>
                <option value="comedy">Comedy</option>
                <option value="drama">Drama</option>
                <option value="horror">Horror</option>
                <option value="romance">Romance</option>
                <option value="sci-fi">Sci-Fi</option>
                <option value="documentary">Documentary</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Price (KES) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value ? parseInt(e.target.value) : '')}
                required
                min="100"
                className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                placeholder="500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">Release Year</label>
              <input
                type="number"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value ? parseInt(e.target.value) : '')}
                min="1900"
                max={new Date().getFullYear()}
                className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                placeholder={new Date().getFullYear().toString()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
                placeholder="English, Swahili, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Subtitles</label>
            <input
              type="text"
              value={subtitles}
              onChange={(e) => setSubtitles(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white"
              placeholder="English, French, etc."
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#1a1a1a] rounded-lg border border-white/10">
            <input
              type="checkbox"
              id="rights"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="w-5 h-5 accent-[#f5c518] mt-1"
            />
            <label htmlFor="rights" className="text-sm text-gray-300">
              I confirm that I own or have the rights to this content and it complies with all platform guidelines.
            </label>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-[#1a1a1a] rounded-lg overflow-hidden">
              <div
                className="bg-[#f5c518] h-2 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f5c518] text-black py-3 rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
          >
            {loading ? `Uploading... ${uploadProgress}%` : 'Upload Content'}
          </button>
        </form>
      </div>
    </div>
  )
}
