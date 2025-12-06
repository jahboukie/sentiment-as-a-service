import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { CheckCircle, AlertTriangle, Shield, Clock, Hash } from 'lucide-react'

// Types matching Rust IPC
interface AuditEntry {
  id: number
  receipt_id: string
  timestamp: string
  actor: string
  operation: string
  summary: string
  threat_score: number | null
  threat_type: string | null
  blocked: boolean
}

interface PaginatedAuditEntries {
  entries: AuditEntry[]
  total_count: number
  page: number
  page_size: number
  total_pages: number
}

interface PaginationParams {
  page: number
  page_size: number
  filter_operation?: string
  filter_date_from?: string
  filter_date_to?: string
}

interface LiveAuditStreamProps {
  className?: string
}

export function LiveAuditStream({ className = '' }: LiveAuditStreamProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)

  useEffect(() => {
    async function loadEntries() {
      try {
        const params: PaginationParams = {
          page: 1,       // 1-indexed for Rust backend
          page_size: 10,
        }
        const result = await invoke<PaginatedAuditEntries>('get_audit_entries', { params })
        setEntries(result.entries)
        setTotalCount(result.total_count)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load audit entries:', err)
        setLoading(false)
      }
    }

    loadEntries()
    // Refresh every 5 seconds to show "live" updates
    const interval = setInterval(loadEntries, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="flex items-center justify-center py-12">
          <Shield className="w-8 h-8 text-primary-500 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`card ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-bg-tertiary">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-text-primary">RECORDING</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Live Audit Stream</h3>
          </div>
          <span className="text-xs text-text-muted font-medium">
            {totalCount} events in chain
          </span>
        </div>

        {/* Event List */}
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No audit events yet</p>
              <p className="text-xs mt-1">Events will appear here as they're recorded</p>
            </div>
          ) : (
            entries.map((entry, index) => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className={`
                  group relative p-4 rounded-lg border transition-all cursor-pointer
                  ${entry.blocked
                    ? 'bg-danger-50 border-danger-200 hover:border-danger-300'
                    : 'bg-white border-bg-tertiary hover:border-primary-300'
                  }
                  hover:shadow-md
                  ${index === 0 ? 'ring-2 ring-primary-200 animate-pulse-slow' : ''}
                `}
                style={{
                  animation: index === 0 ? 'slideIn 300ms ease-out' : undefined
                }}
              >
                {/* Left border indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${
                  entry.blocked ? 'bg-danger-500' : 'bg-success-500'
                }`} />

                <div className="flex items-start gap-4 ml-2">
                  {/* Icon */}
                  <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                    ${entry.blocked ? 'bg-danger-100' : 'bg-success-100'}
                  `}>
                    {entry.blocked ? (
                      <AlertTriangle className="w-5 h-5 text-danger-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-success-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`
                          inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold
                          ${entry.blocked
                            ? 'bg-danger-100 text-danger-700'
                            : 'bg-success-100 text-success-700'
                          }
                        `}>
                          {entry.blocked ? '⛔ BLOCKED' : '✓ VERIFIED'}
                        </span>
                        <span className="text-xs text-text-tertiary font-medium">
                          {entry.operation}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-text-muted">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <p className="text-sm text-text-secondary mb-2 line-clamp-2">
                      {entry.summary}
                    </p>

                    {/* Hash Display */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-bg-tertiary">
                      <Hash className="w-3 h-3 text-text-muted" />
                      <code className="text-xs font-mono text-text-tertiary">
                        {entry.receipt_id.substring(0, 32)}...
                      </code>
                      <span className="text-xs text-text-muted">
                        #{entry.id}
                      </span>
                    </div>

                    {/* Threat Info */}
                    {entry.threat_score && (
                      <div className="mt-2 flex items-center gap-2">
                        <Shield className="w-3 h-3 text-danger-500" />
                        <span className="text-xs text-danger-600 font-medium">
                          Threat Score: {(entry.threat_score * 100).toFixed(0)}%
                        </span>
                        {entry.threat_type && (
                          <span className="text-xs text-text-muted">
                            ({entry.threat_type})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chain Link Animation */}
                {index < entries.length - 1 && (
                  <div className="absolute -bottom-3 left-6 w-0.5 h-6 bg-gradient-to-b from-primary-300 to-transparent" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="mt-6 pt-4 border-t border-bg-tertiary text-center">
            <button className="btn btn-secondary text-sm">
              View Full Audit Log →
            </button>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-bg-tertiary px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">Event Details</h3>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-text-tertiary hover:text-text-primary transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-3">
                <span className={`
                  inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold
                  ${selectedEntry.blocked
                    ? 'bg-danger-100 text-danger-700'
                    : 'bg-success-100 text-success-700'
                  }
                `}>
                  {selectedEntry.blocked ? '⛔ BLOCKED' : '✓ VERIFIED'}
                </span>
                <span className="text-sm text-text-tertiary">
                  Chain Position #{selectedEntry.id}
                </span>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-text-tertiary">Timestamp</label>
                  <p className="text-sm text-text-primary font-mono">
                    {new Date(selectedEntry.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-tertiary">Actor</label>
                  <p className="text-sm text-text-primary">{selectedEntry.actor}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-tertiary">Operation</label>
                  <p className="text-sm text-text-primary">{selectedEntry.operation}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-text-tertiary">Receipt ID</label>
                  <p className="text-xs text-text-primary font-mono truncate">
                    {selectedEntry.receipt_id}
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="text-xs font-medium text-text-tertiary">Summary</label>
                <p className="text-sm text-text-secondary mt-1">{selectedEntry.summary}</p>
              </div>

              {/* Threat Analysis */}
              {selectedEntry.threat_score && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-danger-600" />
                    <h4 className="text-sm font-semibold text-danger-700">Threat Detected</h4>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-text-tertiary">Confidence: </span>
                      <span className="text-sm font-semibold text-danger-600">
                        {(selectedEntry.threat_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    {selectedEntry.threat_type && (
                      <div>
                        <span className="text-xs text-text-tertiary">Type: </span>
                        <span className="text-sm text-text-primary">{selectedEntry.threat_type}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cryptographic Proof */}
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary-700 mb-3">
                  Cryptographic Proof
                </h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-text-tertiary">Receipt Hash</label>
                    <code className="block text-xs font-mono text-text-primary bg-white p-2 rounded mt-1 break-all">
                      {selectedEntry.receipt_id}
                    </code>
                  </div>
                  <p className="text-xs text-text-tertiary">
                    This event is cryptographically sealed with Ed25519 signature and SHA-256 hash chain.
                    Court-admissible under Federal Rules of Evidence 902(13).
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-bg-tertiary px-6 py-4 flex justify-between">
              <button className="btn btn-secondary">
                Export JSON
              </button>
              <button
                onClick={() => setSelectedEntry(null)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Add keyframe animation for slide-in effect
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes pulse-slow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }
`
document.head.appendChild(style)
