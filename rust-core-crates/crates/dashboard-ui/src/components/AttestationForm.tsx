import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Shield,
  FileCheck,
  User,
  Briefcase,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  ChevronDown,
} from 'lucide-react'

// Types matching Rust IPC
interface ComplianceFramework {
  framework_id: string
  name: string
  description: string
  overall_score: number
  controls_total: number
  controls_compliant: number
  controls_partial: number
  controls_non_compliant: number
  last_assessment: string | null
}

interface AttestationSubmission {
  framework_id: string
  control_id: string
  status: string
  evidence_description: string
  attester_name: string
  attester_title: string
}

interface AttestationFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (attestationId: string) => void
}

// Control definitions per framework
const FRAMEWORK_CONTROLS: Record<string, { id: string; name: string; description: string }[]> = {
  'eu-ai-act': [
    { id: 'AIA-1', name: 'Risk Management', description: 'AI risk management system implemented' },
    { id: 'AIA-2', name: 'Data Governance', description: 'Training data quality and governance' },
    { id: 'AIA-3', name: 'Technical Documentation', description: 'Comprehensive technical documentation' },
    { id: 'AIA-4', name: 'Record Keeping', description: 'Automatic logging of events' },
    { id: 'AIA-5', name: 'Transparency', description: 'AI system transparency and disclosure' },
    { id: 'AIA-6', name: 'Human Oversight', description: 'Human oversight mechanisms' },
    { id: 'AIA-7', name: 'Accuracy & Robustness', description: 'Accuracy, robustness, and security' },
    { id: 'AIA-8', name: 'Cybersecurity', description: 'Cybersecurity measures' },
  ],
  'soc2-type2': [
    { id: 'CC1.1', name: 'COSO Principle 1', description: 'Integrity and ethical values' },
    { id: 'CC5.1', name: 'Logical Access', description: 'Logical and physical access controls' },
    { id: 'CC6.1', name: 'System Operations', description: 'System operations security' },
    { id: 'CC7.1', name: 'Change Management', description: 'Change management controls' },
    { id: 'CC8.1', name: 'Risk Management', description: 'Risk management program' },
  ],
  'hipaa': [
    { id: '164.312(a)', name: 'Access Control', description: 'Technical access controls' },
    { id: '164.312(b)', name: 'Audit Controls', description: 'Audit controls implementation' },
    { id: '164.312(c)', name: 'Integrity', description: 'Data integrity controls' },
    { id: '164.312(d)', name: 'Authentication', description: 'Person or entity authentication' },
    { id: '164.312(e)', name: 'Transmission Security', description: 'Transmission security' },
    { id: '164.308(a)(1)', name: 'Security Management', description: 'Security management process' },
  ],
}

export function AttestationForm({ isOpen, onClose, onSuccess }: AttestationFormProps) {
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([])
  const [selectedFramework, setSelectedFramework] = useState<string>('')
  const [selectedControl, setSelectedControl] = useState<string>('')
  const [status, setStatus] = useState<string>('compliant')
  const [evidence, setEvidence] = useState('')
  const [attesterName, setAttesterName] = useState('')
  const [attesterTitle, setAttesterTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadFrameworks()
    }
  }, [isOpen])

  async function loadFrameworks() {
    try {
      const data = await invoke<ComplianceFramework[]>('get_compliance_status')
      setFrameworks(data)
      if (data.length > 0) {
        setSelectedFramework(data[0].framework_id)
      }
      setLoading(false)
    } catch (err) {
      console.error('Failed to load frameworks:', err)
      setLoading(false)
    }
  }

  const availableControls = FRAMEWORK_CONTROLS[selectedFramework] || []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    try {
      const submission: AttestationSubmission = {
        framework_id: selectedFramework,
        control_id: selectedControl,
        status,
        evidence_description: evidence,
        attester_name: attesterName,
        attester_title: attesterTitle,
      }

      const attestationId = await invoke<string>('submit_attestation', { attestation: submission })
      setResult({ success: true, message: `Attestation recorded: ${attestationId}` })
      onSuccess?.(attestationId)
      
      // Reset form
      setSelectedControl('')
      setEvidence('')
    } catch (err) {
      setResult({ success: false, message: `Submission failed: ${err}` })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-bg-tertiary px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-text-primary">Submit Compliance Attestation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors p-1"
            title="Close dialog"
            aria-label="Close attestation form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Shield className="w-8 h-8 text-primary-500 animate-pulse" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-5">
              {/* Framework Selection */}
              <div>
                <label htmlFor="framework" className="block text-sm font-medium text-text-secondary mb-2">
                  Compliance Framework
                </label>
                <div className="relative">
                  <select
                    id="framework"
                    value={selectedFramework}
                    onChange={(e) => {
                      setSelectedFramework(e.target.value)
                      setSelectedControl('')
                    }}
                    className="w-full px-3 py-2 pr-10 border border-bg-tertiary rounded-lg text-sm
                             appearance-none bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  >
                    {frameworks.map((fw) => (
                      <option key={fw.framework_id} value={fw.framework_id}>
                        {fw.name} ({fw.overall_score.toFixed(0)}% compliant)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                </div>
              </div>

              {/* Control Selection */}
              <div>
                <label htmlFor="control" className="block text-sm font-medium text-text-secondary mb-2">
                  Control
                </label>
                <div className="relative">
                  <select
                    id="control"
                    value={selectedControl}
                    onChange={(e) => setSelectedControl(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-10 border border-bg-tertiary rounded-lg text-sm
                             appearance-none bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  >
                    <option value="">Select a control...</option>
                    {availableControls.map((ctrl) => (
                      <option key={ctrl.id} value={ctrl.id}>
                        {ctrl.id}: {ctrl.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                </div>
                {selectedControl && (
                  <p className="text-xs text-text-tertiary mt-1">
                    {availableControls.find((c) => c.id === selectedControl)?.description}
                  </p>
                )}
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Compliance Status
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'compliant', label: 'Compliant', color: 'success', icon: '✓' },
                    { id: 'partial', label: 'Partial', color: 'warning', icon: '◐' },
                    { id: 'non_compliant', label: 'Non-Compliant', color: 'danger', icon: '✗' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatus(s.id)}
                      className={`
                        flex items-center justify-center gap-2 p-3 rounded-lg border transition-all text-sm font-medium
                        ${status === s.id
                          ? `border-${s.color}-500 bg-${s.color}-50 text-${s.color}-700 ring-2 ring-${s.color}-200`
                          : 'border-bg-tertiary text-text-secondary hover:border-primary-300'
                        }
                      `}
                    >
                      <span>{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Evidence Description */}
              <div>
                <label htmlFor="evidence" className="block text-sm font-medium text-text-secondary mb-2">
                  Evidence Description
                </label>
                <textarea
                  id="evidence"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  required
                  minLength={10}
                  rows={4}
                  placeholder="Describe the evidence supporting this attestation. Include references to audit records, policies, or technical controls..."
                  className="w-full px-3 py-2 border border-bg-tertiary rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500
                           resize-none"
                />
                <p className="text-xs text-text-tertiary mt-1">
                  Minimum 10 characters. Be specific and reference verifiable evidence.
                </p>
              </div>

              {/* Attester Information */}
              <div className="bg-primary-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Attester Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="attesterName" className="block text-xs font-medium text-text-secondary mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        id="attesterName"
                        type="text"
                        value={attesterName}
                        onChange={(e) => setAttesterName(e.target.value)}
                        required
                        placeholder="Jane Smith"
                        className="w-full pl-9 pr-3 py-2 border border-bg-tertiary rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="attesterTitle" className="block text-xs font-medium text-text-secondary mb-1">
                      Title / Role
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        id="attesterTitle"
                        type="text"
                        value={attesterTitle}
                        onChange={(e) => setAttesterTitle(e.target.value)}
                        required
                        placeholder="Chief Compliance Officer"
                        className="w-full pl-9 pr-3 py-2 border border-bg-tertiary rounded-lg text-sm
                                 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cryptographic Notice */}
              <div className="bg-gray-50 border border-bg-tertiary rounded-lg p-3 flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-text-secondary">
                    This attestation will be cryptographically signed using Ed25519 and added to the 
                    tamper-evident audit chain. It will be court-admissible under Federal Rules of Evidence 902(13).
                  </p>
                </div>
              </div>

              {/* Result Message */}
              {result && (
                <div className={`
                  flex items-start gap-3 p-4 rounded-lg
                  ${result.success ? 'bg-success-50' : 'bg-danger-50'}
                `}>
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />
                  )}
                  <div className={`text-sm ${result.success ? 'text-success-700' : 'text-danger-700'}`}>
                    {result.message}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-bg-tertiary px-6 py-4 flex justify-between">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedControl || !attesterName || !evidence}
                className="btn btn-primary flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Sign &amp; Submit
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Attestation button for easy integration
interface AttestationButtonProps {
  className?: string
}

export function AttestationButton({ className = '' }: AttestationButtonProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className={`btn btn-secondary flex items-center gap-2 ${className}`}
      >
        <FileCheck className="w-4 h-4" />
        Add Attestation
      </button>
      
      <AttestationForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
      />
    </>
  )
}
