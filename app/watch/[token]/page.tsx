import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

export default async function OldWatchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  console.log('🔀 Old watch URL detected, redirecting...')

  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const currentPath = `/watch/${token}`
    redirect(`/auth/login?redirectTo=${currentPath}`)
  }

  const { data, error } = await supabase
    .from('purchases')
    .select(`
      status,
      content:content_id (
        id,
        slug,
        category
      )
    `)
    .eq('watch_token', token)
    .eq('status', 'completed') // ✅ same fix as the API route
    .is('revoked_at', null)
    .single()

  if (error || !data) {
    console.error('❌ No completed purchase found for token:', token)
    notFound()
  }

  const content = data.content as any

  const categoryPath = content?.category ? content.category.toLowerCase() : 'film'
  const slug = content?.slug || content?.id
  const newUrl = `/watch/${categoryPath}/${slug}`

  console.log('🔀 Redirecting to new URL:', newUrl)
  redirect(newUrl)
}
