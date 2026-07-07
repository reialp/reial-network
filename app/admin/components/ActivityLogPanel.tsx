import type { ActivityLog } from '../types'

export default function ActivityLogPanel({
  activityLogs, loadingLogs, onClose,
}: {
  activityLogs: ActivityLog[]
  loadingLogs: boolean
  onClose: () => void
}) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg sm:text-xl font-bold">Activity Logs</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Close</button>
      </div>
      <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden max-h-[400px] overflow-y-auto">
        {loadingLogs ? (
          <div className="p-4 text-center text-gray-400">Loading logs...</div>
        ) : activityLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No activity logs found.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {activityLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-white/5 transition">
                <div className="flex items-start gap-3">
                  <div className={`w-1 h-full min-h-[40px] rounded-full ${
                    log.action.includes('approve') ? 'bg-green-500' :
                    log.action.includes('reject') || log.action.includes('delete') ? 'bg-red-500' :
                    log.action.includes('payout') ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{log.admin?.full_name || 'System'}</span>
                      <span className="text-gray-400 text-xs">{log.action.replace(/_/g, ' ')}</span>
                      <span className="text-gray-500 text-xs">{log.target_type}</span>
                      <span className="text-gray-500 text-xs ml-auto">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.details && (
                      <div className="text-xs text-gray-400 mt-1">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
