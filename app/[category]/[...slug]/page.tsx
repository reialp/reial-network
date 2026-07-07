export default async function TestPage({
  params,
}: {
  params: Promise<{ category: string; slug: string[] }>
}) {
  const { category, slug } = await params
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <h1 className="text-3xl font-bold text-green-400">ROUTE IS WORKING!</h1>
      <p className="mt-4 text-xl">Category: <strong>{category}</strong></p>
      <p className="mt-2 text-xl">Slug: <strong>{slug.join('/')}</strong></p>
      <p className="mt-8 text-gray-400">If you see this, the route is working.</p>
      <p className="text-gray-400">Now we can add the real content back.</p>
    </div>
  )
}
