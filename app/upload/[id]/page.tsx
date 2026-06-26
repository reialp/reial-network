'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EditFilmPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [trailerUrl, setTrailerUrl] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [releaseYear, setReleaseYear] = useState<number | ''>('')
  const [language, setLanguage] = useState('')
  const [subtitles, setSubtitles] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')

  useEffect(() => {
    async function loadFilm() {
      const id = params.id as string
      if (!id) {
        setError('No film ID provided')
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setError('Film not found')
        setLoading(false)
        return
      }

      if (data.creator_id !== session.user.id) {
        setError('You do not have permission to edit this film')
        setLoading(false)
        return
      }

      // Pre-fill form
      setTitle(data.title)
      setDescription(data.description || '')
      setThumbnailUrl(data.thumbnail_url || '')
      setVideoUrl(data.video_url)
      setTrailerUrl(data.trailer_url || '')
      setCategory(data.category || '')
      setPrice(data.price)
      setReleaseYear(data.release_year || '')
      setLanguage(data.language || '')
      setSubtitles(data.subtitles || '')
      setRightsConfirmed(!!data.rights_confirmed_at)
      setCurrentStatus(data.status)

      setLoading(false)
    }
    loadFilm()
  }, [params.id, supabase, router])

  const handleSubmit = async (newStatus: string | null = null) => {
    if (!rightsConfirmed) {
      setError('You must confirm rights.')
      return
    }
    if (!title || !videoUrl || !price || !category) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Please log in again.')
      setSubmitting(false)
      return
    }

    const payload: any = {
      title,
      description: description || null,
      thumbnail_url: thumbnailUrl || null,
      video_url: videoUrl,
      trailer_url: trailerUrl || null,
      category,
      price: Number(price),
      release_year: releaseYear ? Number(releaseYear) : null,
      language: language || null,
      subtitles: subtitles || null,
      rights_confirmed_at: rightsConfirmed ? new Date().toISOString() : null,
    }

    // Only change status if explicitly provided
    if (newStatus !== null) {
      payload.status = newStatus
    }

    const { error: updateError } = await supabase
      .from('content')
      .update(payload)
      .eq('id', params.id as string)
      .eq('creator_id', session.user.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-[#f5c518] hover:underline">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] rounded-2xl p-8 max-w-md w-full text-center border border-white/10">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold">Updated!</h2>
          <p className="text-gray-400 mt-2">Your changes have been saved.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-6 bg-[#f5c518] text-black px-6 py-2 rounded-lg font-semibold hover:bg-[#e0b010] transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Film</h1>
          <p className="text-gray-400 text-sm mt-1">
            Update your film details. Current status: <span className="text-[#f5c518] font-semibold">{currentStatus}</span>
          </p>
        </div>

        <form className="space-y-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Film Details */}
          <section className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-[#f5c518]">📝</span> Film Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 resize-none transition"
                />
              </div>
            </div>
          </section>

          {/* Media */}
          <section className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-[#f5c518]">🎬</span> Media
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Thumbnail URL</label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                />
                {thumbnailUrl && (
                  <div className="mt-2 w-32 h-32 rounded-lg overflow-hidden border border-white/10">
                    <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Video URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                />
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <p>🎬 <span className="text-[#f5c518] font-medium">YouTube Creators:</span> Keep your video <strong className="text-white">Unlisted</strong> for best results.</p>
                  <p>📈 Every purchase counts as a view on your YouTube channel – helping you grow your audience!</p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300">Trailer URL (optional)</label>
              <input
                type="url"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
              />
            </div>
          </section>

          {/* Pricing & Metadata */}
          <section className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-[#f5c518]">💰</span> Pricing & Metadata
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white transition"
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
                <label className="block text-sm font-medium text-gray-300">
                  Price (KES) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                  min="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Release Year</label>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                  min="1900"
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Subtitles</label>
                <input
                  type="text"
                  value={subtitles}
                  onChange={(e) => setSubtitles(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-lg focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 transition"
                />
              </div>
            </div>
          </section>

          {/* Rights Confirmation */}
          <section className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(e) => setRightsConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 accent-[#f5c518]"
                required
              />
              <label className="text-sm text-gray-300 leading-relaxed">
                I confirm that I own the rights to distribute this content and it does not infringe on any copyrights.
                <span className="text-red-400 ml-1">*</span>
              </label>
            </div>
          </section>

          {/* Actions – Three options */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={() => handleSubmit()} // Keep current status
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-[#f5c518] text-black rounded-lg font-semibold hover:bg-[#e0b010] transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : '💾 Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={submitting}
              className="flex-1 px-6 py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/5 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : '📄 Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('pending')}
              disabled={submitting}
              className="flex-1 px-6 py-3 border border-white/20 rounded-lg font-semibold hover:bg-white/5 transition disabled:opacity-50"
            >
              {submitting ? 'Saving...' : '📤 Submit for Approval'}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            💡 "Save Changes" keeps your current status (approved/pending/draft). Use the other buttons to change status.
          </p>
        </form>
      </div>
    </div>
  )
}