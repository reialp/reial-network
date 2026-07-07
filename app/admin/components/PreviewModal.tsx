import type { Content } from '../types'

function getEmbedUrl(url: string): string {
  if (!url) return ''
  if (url.includes('/embed/')) return url
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
  if (match) return `https://www.youtube.com/embed/${match[1]}`
  return url
}

export default function PreviewModal({
  film, onClose, onApprove, onReject,
}: {
  film: Content
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="sticky top-0 bg-[#1a1a1a] px-3 sm:px-4 md:px-6 py-2.5 sm:py-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-sm sm:text-base md:text-xl font-bold truncate max-w-[200px] sm:max-w-[300px]">{film.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition p-1">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          <div className="aspect-video bg-[#0a0a0a] rounded-lg sm:rounded-xl overflow-hidden">
            <iframe src={getEmbedUrl(film.video_url)} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <h3 className="text-xs sm:text-sm text-gray-400">Description</h3>
              <p className="mt-1 text-xs sm:text-sm">{film.description || 'No description.'}</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <div><span className="text-xs sm:text-sm text-gray-400">Creator:</span> <span className="ml-2 text-xs sm:text-sm">{film.creator_name || 'Unknown'}</span></div>
              <div><span className="text-xs sm:text-sm text-gray-400">Price:</span> <span className="ml-2 text-[#f5c518] font-bold text-xs sm:text-sm">KES {film.price}</span></div>
              <div><span className="text-xs sm:text-sm text-gray-400">Status:</span> <span className="ml-2 text-xs sm:text-sm">{film.status}</span></div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-white/10">
            {film.status === 'pending' && (
              <>
                <button onClick={onApprove} className="flex-1 bg-green-500 text-white py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-green-600 transition">Approve</button>
                <button onClick={onReject} className="flex-1 bg-red-500 text-white py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition">Reject</button>
              </>
            )}
            <button onClick={onClose} className="flex-1 border border-white/20 py-1.5 sm:py-2 rounded-lg text-sm font-semibold hover:bg-white/5 transition">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
