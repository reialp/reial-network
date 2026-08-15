'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'

interface Profile {
  id: string
  full_name: string
  bio: string
  avatar_url: string
  is_creator: boolean
  payout_phone: string
  cover_image: string
  tagline: string
  location: string
  skills: string[]
  social_instagram: string
  social_twitter: string
  social_youtube: string
  social_website: string
  featured_project_id: string | null
}

function ProfileForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const intent = searchParams.get('intent')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showScrollHint, setShowScrollHint] = useState(false)
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [featuredProjectTitle, setFeaturedProjectTitle] = useState<string>('')
  const editFormRef = useRef<HTMLDivElement>(null)
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile>({
    id: '',
    full_name: '',
    bio: '',
    avatar_url: '',
    is_creator: false,
    payout_phone: '',
    cover_image: '',
    tagline: '',
    location: '',
    skills: [],
    social_instagram: '',
    social_twitter: '',
    social_youtube: '',
    social_website: '',
    featured_project_id: null,
  })

  const [originalProfile, setOriginalProfile] = useState<Profile>({
    id: '',
    full_name: '',
    bio: '',
    avatar_url: '',
    is_creator: false,
    payout_phone: '',
    cover_image: '',
    tagline: '',
    location: '',
    skills: [],
    social_instagram: '',
    social_twitter: '',
    social_youtube: '',
    social_website: '',
    featured_project_id: null,
  })

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      setUserId(session.user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error && error.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            full_name: session.user.user_metadata?.full_name || '',
            is_creator: false,
            terms_accepted: false,
          })

        if (!insertError) {
          loadProfile()
          return
        } else {
          setError('Failed to create profile. Please try again.')
          setLoading(false)
          return
        }
      }

      if (data) {
        const loadedProfile = {
          id: data.id,
          full_name: data.full_name || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || '',
          is_creator: data.is_creator || false,
          payout_phone: data.payout_phone || '',
          cover_image: data.cover_image || '',
          tagline: data.tagline || '',
          location: data.location || '',
          skills: data.skills || [],
          social_instagram: data.social_instagram || '',
          social_twitter: data.social_twitter || '',
          social_youtube: data.social_youtube || '',
          social_website: data.social_website || '',
          featured_project_id: data.featured_project_id || null,
        }
        setProfile(loadedProfile)
        setOriginalProfile(loadedProfile)
        
        if (data.featured_project_id) {
          const { data: featured } = await supabase
            .from('content')
            .select('title')
            .eq('id', data.featured_project_id)
            .single()
          if (featured) {
            setFeaturedProjectTitle(featured.title)
          }
        }
        
        if (!loadedProfile.full_name && !loadedProfile.bio) {
          setIsEditing(true)
        }
      }

      if (session?.user) {
        const { data: projectsData } = await supabase
          .from('content')
          .select('id, title')
          .eq('creator_id', session.user.id)
          .eq('status', 'approved')
        setProjects(projectsData || [])
      }

      setLoading(false)
    }
    loadProfile()
  }, [router, supabase])

  // Scroll to edit form when editing starts
  useEffect(() => {
    if (isEditing && editFormRef.current) {
      setShowScrollHint(true)
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setTimeout(() => setShowScrollHint(false), 3000)
      }, 300)
    }
  }, [isEditing])

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
      const filePath = `${folder}/${fileName}`

      const { error } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        return null
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    const url = await uploadImage(file, 'avatars')
    if (url) {
      setProfile({ ...profile, avatar_url: url })
    }
    setUploadingAvatar(false)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    const url = await uploadImage(file, 'covers')
    if (url) {
      setProfile({ ...profile, cover_image: url })
    }
    setUploadingCover(false)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    if (!userId) {
      setError('Not authenticated')
      setSaving(false)
      return
    }

    const wasCreator = profile.is_creator
    const currentProfile = { ...profile }

    const featuredProjectId = currentProfile.featured_project_id === '' ? null : currentProfile.featured_project_id

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: currentProfile.full_name,
        bio: currentProfile.bio,
        avatar_url: currentProfile.avatar_url,
        is_creator: currentProfile.is_creator,
        payout_phone: currentProfile.payout_phone,
        cover_image: currentProfile.cover_image,
        tagline: currentProfile.tagline,
        location: currentProfile.location,
        skills: currentProfile.skills,
        social_instagram: currentProfile.social_instagram,
        social_twitter: currentProfile.social_twitter,
        social_youtube: currentProfile.social_youtube,
        social_website: currentProfile.social_website,
        featured_project_id: featuredProjectId,
      })
      .eq('id', userId)

    if (updateError) {
      setError('Failed to save: ' + updateError.message)
      setSaving(false)
      return
    }

    if (currentProfile.featured_project_id) {
      const { data: featured } = await supabase
        .from('content')
        .select('title')
        .eq('id', currentProfile.featured_project_id)
        .single()
      if (featured) {
        setFeaturedProjectTitle(featured.title)
      }
    } else {
      setFeaturedProjectTitle('')
    }

    setSuccess(true)
    setSaving(false)
    setOriginalProfile({ ...currentProfile })
    setIsEditing(false)
    setShowScrollHint(false)

    if (intent === 'creator' && currentProfile.is_creator && !wasCreator) {
      setTimeout(() => {
        router.push('/terms')
      }, 1000)
      return
    }

    setTimeout(() => setSuccess(false), 2000)
  }

  const handleCancel = () => {
    setProfile({ ...originalProfile })
    setIsEditing(false)
    setShowScrollHint(false)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleSkillsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
    setProfile({ ...profile, skills })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading profile...</p>
        </div>
      </div>
    )
  }

  const hasProfile = profile.full_name || profile.bio || profile.avatar_url

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Cover Image */}
      {profile.cover_image ? (
        <div className="relative w-full h-[200px] sm:h-[280px] md:h-[350px] overflow-hidden">
          <Image
            src={profile.cover_image}
            alt="Cover"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />
        </div>
      ) : (
        <div className="relative w-full h-[150px] sm:h-[200px] md:h-[250px] bg-gradient-to-r from-[#f5c518]/10 to-[#f5c518]/5 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#f5c518]/10 flex items-center justify-center mx-auto">
                <span className="text-2xl text-gray-500">No cover</span>
              </div>
              <p className="text-gray-500 text-sm mt-2">Add a cover image</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-16 sm:-mt-20 relative z-10">
        
        {/* Profile Card */}
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#2a2a2a] border-4 border-[#0a0a0a] overflow-hidden flex-shrink-0">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name || 'Profile'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl text-gray-500">
                    No avatar
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {profile.full_name || 'Set up your profile'}
                </h1>
                {profile.tagline && (
                  <p className="text-gray-300 text-sm mt-0.5 italic">"{profile.tagline}"</p>
                )}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                  {profile.is_creator && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-3 py-0.5 rounded-full border border-green-500/20">
                      Creator
                    </span>
                  )}
                  {profile.location && (
                    <span className="text-xs text-gray-400">
                      {profile.location}
                    </span>
                  )}
                </div>
                {profile.bio && (
                  <p className="text-gray-400 text-sm mt-3 leading-relaxed">{profile.bio}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                {profile.is_creator && userId && (
                  <Link
                    href={`/creator/${userId}/analytics`}
                    className="px-4 py-2 bg-[#f5c518]/10 hover:bg-[#f5c518]/20 border border-[#f5c518]/30 text-[#f5c518] rounded-lg text-sm font-medium transition"
                  >
                    Analytics
                  </Link>
                )}
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-[#f5c518] text-black rounded-lg text-sm font-medium hover:bg-[#e0b010] transition shadow-lg shadow-[#f5c518]/20"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Skills Tags */}
            {profile.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/5">
                <span className="text-xs text-gray-500 font-medium mr-2">Skills</span>
                {profile.skills.map((skill, i) => (
                  <span key={i} className="bg-[#0a0a0a] px-3 py-1 rounded-full text-xs text-gray-300 border border-white/5">
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Social Links - no icons, just plain text links */}
            {(profile.social_instagram || profile.social_twitter || profile.social_youtube || profile.social_website) && (
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5">
                {profile.social_instagram && (
                  <a href={profile.social_instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm">
                    Instagram
                  </a>
                )}
                {profile.social_twitter && (
                  <a href={profile.social_twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm">
                    Twitter
                  </a>
                )}
                {profile.social_youtube && (
                  <a href={profile.social_youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm">
                    YouTube
                  </a>
                )}
                {profile.social_website && (
                  <a href={profile.social_website} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#f5c518] transition text-sm">
                    Website
                  </a>
                )}
              </div>
            )}

            {/* Featured Project */}
            {featuredProjectTitle && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Featured Project</p>
                <p className="text-[#f5c518] font-medium text-sm mt-1">{featuredProjectTitle}</p>
              </div>
            )}

            {/* Bottom Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="text-xs text-gray-500">Payout</span>
                <span className="font-mono text-sm">{profile.payout_phone || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://wa.me/254704908255"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-lg text-xs font-medium transition"
                >
                  WhatsApp
                </a>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        {isEditing && (
          <>
            {/* Scroll Hint Notification */}
            {showScrollHint && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-bounce">
                <div className="bg-[#f5c518] text-black px-6 py-3 rounded-full font-semibold shadow-2xl flex items-center gap-3">
                  <span>Scroll down to edit your profile</span>
                </div>
              </div>
            )}

            <div ref={editFormRef} className="mt-6 bg-[#1a1a1a] rounded-2xl border border-[#f5c518]/20 shadow-2xl p-6 sm:p-8 scroll-mt-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#f5c518]">Edit Profile</h2>
                <span className="text-xs text-gray-500">All fields are optional except Full Name</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-xl text-sm">
                    Profile saved successfully
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Tagline</label>
                    <input
                      type="text"
                      value={profile.tagline}
                      onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                      className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                      placeholder="e.g. Award-winning filmmaker"
                    />
                    <p className="text-gray-500 text-[10px] mt-1">Short description under your name</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={3}
                    className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm resize-none transition"
                    placeholder="Tell your audience about yourself..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Location</label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                      className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                      placeholder="e.g. Nairobi, Kenya"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Skills / Genres</label>
                    <input
                      type="text"
                      value={profile.skills.join(', ')}
                      onChange={handleSkillsChange}
                      className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                      placeholder="e.g. Documentary, Film, Music"
                    />
                    <p className="text-gray-500 text-[10px] mt-1">Comma-separated list</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Avatar</label>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#0a0a0a] overflow-hidden border border-white/10 flex-shrink-0">
                        {profile.avatar_url ? (
                          <Image
                            src={profile.avatar_url}
                            alt="Avatar"
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">None</div>
                        )}
                      </div>
                      <label className="cursor-pointer bg-[#0a0a0a] border border-white/10 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 transition">
                        {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                      </label>
                      {profile.avatar_url && (
                        <button
                          type="button"
                          onClick={() => setProfile({ ...profile, avatar_url: '' })}
                          className="text-red-400 text-sm hover:text-red-300 transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Cover Image</label>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="w-16 h-10 bg-[#0a0a0a] overflow-hidden border border-white/10 rounded flex-shrink-0">
                        {profile.cover_image ? (
                          <Image
                            src={profile.cover_image}
                            alt="Cover"
                            width={64}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">None</div>
                        )}
                      </div>
                      <label className="cursor-pointer bg-[#0a0a0a] border border-white/10 px-3 py-1.5 rounded-lg text-sm hover:bg-white/5 transition">
                        {uploadingCover ? 'Uploading...' : 'Upload Cover'}
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          className="hidden"
                          disabled={uploadingCover}
                        />
                      </label>
                      {profile.cover_image && (
                        <button
                          type="button"
                          onClick={() => setProfile({ ...profile, cover_image: '' })}
                          className="text-red-400 text-sm hover:text-red-300 transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-300">Social Links</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Instagram</label>
                      <input
                        type="url"
                        value={profile.social_instagram}
                        onChange={(e) => setProfile({ ...profile, social_instagram: e.target.value })}
                        className="mt-1 block w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                        placeholder="https://instagram.com/yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Twitter</label>
                      <input
                        type="url"
                        value={profile.social_twitter}
                        onChange={(e) => setProfile({ ...profile, social_twitter: e.target.value })}
                        className="mt-1 block w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                        placeholder="https://twitter.com/yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">YouTube</label>
                      <input
                        type="url"
                        value={profile.social_youtube}
                        onChange={(e) => setProfile({ ...profile, social_youtube: e.target.value })}
                        className="mt-1 block w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                        placeholder="https://youtube.com/@yourhandle"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Website</label>
                      <input
                        type="url"
                        value={profile.social_website}
                        onChange={(e) => setProfile({ ...profile, social_website: e.target.value })}
                        className="mt-1 block w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                  </div>
                </div>

                {profile.is_creator && projects.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Featured Project</label>
                    <select
                      value={profile.featured_project_id || ''}
                      onChange={(e) => setProfile({ ...profile, featured_project_id: e.target.value || null })}
                      className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white text-sm"
                    >
                      <option value="">No featured project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Payout Phone <span className="text-gray-500">(M-Pesa)</span>
                  </label>
                  <input
                    type="text"
                    value={profile.payout_phone}
                    onChange={(e) => setProfile({ ...profile, payout_phone: e.target.value })}
                    className="mt-1.5 block w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-[#f5c518] focus:border-transparent outline-none text-white placeholder-gray-500 text-sm transition"
                    placeholder="0712345678"
                  />
                </div>

                <div className={`rounded-xl p-4 border transition ${
                  intent === 'creator' 
                    ? 'bg-[#f5c518]/10 border-[#f5c518]' 
                    : 'bg-[#0a0a0a] border-white/10'
                }`}>
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="is_creator"
                      checked={profile.is_creator}
                      onChange={(e) => setProfile({ ...profile, is_creator: e.target.checked })}
                      className="w-5 h-5 accent-[#f5c518] flex-shrink-0 rounded border-white/20"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-300">Become a Creator</p>
                      <p className="text-xs text-gray-500">Upload and sell your content to earn 70% of every sale</p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-[#f5c518] text-black py-3 rounded-xl font-semibold hover:bg-[#e0b010] transition disabled:opacity-50 text-sm sm:text-base"
                  >
                    {saving ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-3 border border-white/20 rounded-xl font-semibold hover:bg-white/5 transition text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Floating WhatsApp Button - keeping only the text link, removed icon, but we can keep as a simple text button for clarity */}
      <a
        href="https://wa.me/254704908255"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
          <div className="relative w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300 text-white text-sm font-bold">
            WA
          </div>
        </div>
      </a>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <ProfileForm />
    </Suspense>
  )
}
