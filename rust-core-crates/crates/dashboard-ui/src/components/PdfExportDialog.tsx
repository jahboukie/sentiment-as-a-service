import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { FileText, Download, Loader2, CheckCircle, AlertTriangle, X } from 'lucide-react'

interface PdfExportOptions {
  report_type: string
  framework_id: string | null
  date_from: string | null
  date_to: string | null
  include_signatures: boolean
  company_name: string | null
  prepared_by: string | null
}

interface PdfExportDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (path: string) => void
}

export function PdfExportDialog({ isOpen, onClose, onSuccess }: PdfExportDialogProps) {
  const [reportType, setReportType] = useState<string>('compliance')
  const [companyName, setCompanyName] = useState('')
  const [preparedBy, setPreparedBy] = useState('')
  const [includeSignatures, setIncludeSignatures] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  if (!isOpen) return null

  async function handleExport() {
    setExporting(true)
    setResult(null)

    try {
      const options: PdfExportOptions = {
        report_type: reportType,
        framework_id: null,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        include_signatures: includeSignatures,
        company_name: companyName || null,
        prepared_by: preparedBy || null,
      }

      const path = await invoke<string>('export_pdf_report', { options })
      setResult({ success: true, message: `Report exported: ${path}` })
      onSuccess?.(path)
    } catch (err) {
      setResult({ success: false, message: `Export failed: ${err}` })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-bg-tertiary px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-text-primary">Export PDF Report</h3>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors p-1"
            title="Close dialog"
            aria-label="Close export dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Report Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'compliance', label: 'Compliance Report', desc: 'Full framework assessment' },
                { id: 'audit', label: 'Audit Trail', desc: 'Detailed event log' },
                { id: 'executive', label: 'Executive Summary', desc: 'High-level overview' },
                { id: 'attestation', label: 'Attestation', desc: 'Signed compliance proof' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setReportType(type.id)}
                  className={`
                    p-3 rounded-lg border text-left transition-all
                    ${reportType === type.id
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-bg-tertiary hover:border-primary-300'
                    }
                  `}
                >
                  <span className="text-sm font-medium text-text-primary">{type.label}</span>
                  <p className="text-xs text-text-tertiary mt-0.5">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter organization name"
              className="w-full px-3 py-2 border border-bg-tertiary rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
            />
          </div>

          {/* Prepared By */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Prepared By
            </label>
            <input
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              placeholder="Enter preparer name/title"
              className="w-full px-3 py-2 border border-bg-tertiary rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-text-secondary mb-2">
                Period Start
              </label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Select start date"
                className="w-full px-3 py-2 border border-bg-tertiary rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
              />
            </div>
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-text-secondary mb-2">
                Period End
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Select end date"
                className="w-full px-3 py-2 border border-bg-tertiary rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Include Signatures */}
          <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
            <input
              type="checkbox"
              id="includeSignatures"
              checked={includeSignatures}
              onChange={(e) => setIncludeSignatures(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="includeSignatures" className="text-sm text-text-primary">
              <span className="font-medium">Include cryptographic attestation</span>
              <p className="text-xs text-text-tertiary mt-0.5">
                Add Ed25519 signature for court-admissible evidence
              </p>
            </label>
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
                <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
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
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-primary flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Export button component for easy integration
interface ExportButtonProps {
  className?: string
}

export function ExportButton({ className = '' }: ExportButtonProps) {
  const [showDialog, setShowDialog] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className={`btn btn-primary flex items-center gap-2 ${className}`}
      >
        <FileText className="w-4 h-4" />
        Export PDF
      </button>
      
      <PdfExportDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
      />
    </>
  )
}
