export default async function TestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <h1 className="text-3xl font-bold">Test Route</h1>
      <p className="mt-4">ID: <strong>{id}</strong></p>
      <p className="mt-4 text-green-400">If you see this, dynamic routes work!</p>
    </div>
  )
}
