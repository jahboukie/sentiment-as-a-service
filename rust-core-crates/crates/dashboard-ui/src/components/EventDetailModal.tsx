import React, { useEffect } from 'react';
import { 
  X, Copy, ExternalLink, Clock, Hash, 
  Shield, AlertTriangle, CheckCircle2, Fingerprint,
  Link2, FileJson
} from 'lucide-react';

interface EventDetailModalProps {
  event: {
    id: string;
    timestamp: Date;
    type: string;
    action: string;
    source: string;
    details: string;
    hash: string;
    chainPosition: number;
    severity?: string;
    confidence?: number;
    vectorDistance?: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onCopyHash?: (hash: string) => void;
  onExportJson?: (event: any) => void;
  onViewInChain?: (position: number) => void;
}

const actionConfig: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  verified: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  blocked: { icon: Shield, color: 'text-red-600', bg: 'bg-red-100' },
  flagged: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
  attested: { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100' },
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onCopyHash,
  onExportJson,
  onViewInChain,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !event) return null;

  const config = actionConfig[event.action] || actionConfig.verified;
  const ActionIcon = config.icon;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopyHash?.(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden pointer-events-auto animate-slideUp"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <ActionIcon className={`w-5 h-5 ${config.color}`} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Event Details</h2>
                <p className="text-sm text-slate-500">Chain Position #{event.chainPosition.toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Status Badge */}
            <div className="flex items-center gap-3 mb-6">
              <span className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                ${config.bg} ${config.color}
              `}>
                <ActionIcon className="w-4 h-4" />
                {event.action.toUpperCase()}
              </span>
              {event.severity && (
                <span className={`
                  px-3 py-1.5 rounded-full text-xs font-medium uppercase
                  ${event.severity === 'critical' ? 'bg-purple-100 text-purple-700' :
                    event.severity === 'high' ? 'bg-red-100 text-red-700' :
                    event.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'}
                `}>
                  {event.severity} severity
                </span>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Clock className="w-4 h-4" />
                  Timestamp
                </div>
                <div className="font-medium text-slate-900">
                  {event.timestamp.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Fingerprint className="w-4 h-4" />
                  Event ID
                </div>
                <div className="font-mono text-sm text-slate-900">{event.id}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Link2 className="w-4 h-4" />
                  Chain Position
                </div>
                <div className="font-mono font-medium text-slate-900">
                  #{event.chainPosition.toLocaleString()}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <Shield className="w-4 h-4" />
                  Source
                </div>
                <div className="font-medium text-slate-900">{event.source}</div>
              </div>
            </div>

            {/* Hash Section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <Hash className="w-4 h-4" />
                Content Hash (SHA-256)
              </div>
              <div className="relative group">
                <div className="p-4 bg-slate-900 rounded-xl font-mono text-sm text-emerald-400 break-all">
                  {event.hash}
                </div>
                <button
                  onClick={() => copyToClipboard(event.hash)}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                  title="Copy hash"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Threat Analysis (if applicable) */}
            {(event.confidence !== undefined || event.vectorDistance !== undefined) && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <h3 className="font-medium text-amber-900 mb-3">Threat Analysis</h3>
                <div className="grid grid-cols-2 gap-4">
                  {event.confidence !== undefined && (
                    <div>
                      <div className="text-sm text-amber-700">Detection Confidence</div>
                      <div className="text-lg font-bold text-amber-900">
                        {(event.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {event.vectorDistance !== undefined && (
                    <div>
                      <div className="text-sm text-amber-700">Vector Distance</div>
                      <div className="text-lg font-bold text-amber-900">
                        {event.vectorDistance.toFixed(4)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Event Details */}
            <div>
              <div className="text-sm text-slate-500 mb-2">Event Details</div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-slate-700">{event.details}</p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={() => copyToClipboard(event.hash)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-white transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Hash
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onExportJson?.(event)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-white transition-colors"
              >
                <FileJson className="w-4 h-4" />
                Export JSON
              </button>
              <button
                onClick={() => onViewInChain?.(event.chainPosition)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View in Chain
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default EventDetailModal;
