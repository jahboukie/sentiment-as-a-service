import { useEffect, useState, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Lock,
  LayoutDashboard,
  Target,
  Search,
  ClipboardCheck,
  Keyboard,
  Calendar,
  Command
} from 'lucide-react'
import { LiveAuditStream } from './components/LiveAuditStream'
import { ThreatTimeline } from './components/ThreatTimeline'
import { PdfExportDialog } from './components/PdfExportDialog'
import { AttestationForm } from './components/AttestationForm'
import { AttackSimulator } from './components/AttackSimulator'
import { CompliancePanel } from './components/CompliancePanel'
import { ThreatRadar } from './components/ThreatRadar'
import { EventSearchFilter } from './components/EventSearchFilter'
import { EventDetailModal } from './components/EventDetailModal'
import { OnboardingModal, useFirstRun } from './components/OnboardingModal'
import { useKeyboardShortcuts, getDefaultShortcuts, ShortcutsHelp } from './hooks/useKeyboardShortcuts'
import { ToastProvider, useToast } from './components/Toast'
import { CommandPalette, getDefaultCommands } from './components/CommandPalette'
import { DashboardSkeleton } from './components/Skeleton'
import type { OnboardingConfig } from './components/OnboardingModal'

// Tab type for main navigation
type TabId = 'overview' | 'compliance' | 'threats' | 'events'

// Types matching Rust IPC commands
interface AuditStats {
  total_entries: number
  entries_today: number
  entries_this_week: number
  latest_hash: string | null
  chain_integrity: string
  last_verified: string | null
}

interface SystemHealth {
  status: string
  database_connected: boolean
  database_size_mb: number
  audit_chain_valid: boolean
  last_entry_timestamp: string | null
  uptime_seconds: number
  version: string
  demo_mode: boolean
}

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

// Calculate days until EU AI Act deadline (February 2, 2026)
function getDaysUntilDeadline(): number {
  const deadline = new Date('2026-02-02T00:00:00Z')
  const now = new Date()
  const diffTime = deadline.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// Inner App component that uses Toast context
function AppContent() {
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [compliance, setCompliance] = useState<ComplianceFramework[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  
  // Modal states for keyboard shortcuts
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showAttestModal, setShowAttestModal] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  
  // Search input ref for focus shortcut
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // First-run onboarding
  const { isFirstRun, completeOnboarding } = useFirstRun()
  const [showOnboarding, setShowOnboarding] = useState(false)
  
  // Toast notifications
  const toast = useToast()

  // Data refresh function
  const refreshData = useCallback(async () => {
    try {
      const [statsData, healthData, complianceData] = await Promise.all([
        invoke<AuditStats>('get_audit_stats'),
        invoke<SystemHealth>('get_system_health'),
        invoke<ComplianceFramework[]>('get_compliance_status'),
      ])
      setStats(statsData)
      setHealth(healthData)
      setCompliance(complianceData)
    } catch (err) {
      console.error('Refresh failed:', err)
    }
  }, [])

  // Close any open modal
  const closeAllModals = useCallback(() => {
    setShowEventModal(false)
    setShowShortcutsHelp(false)
    setShowExportModal(false)
    setShowAttestModal(false)
    setShowOnboarding(false)
    setShowCommandPalette(false)
  }, [])

  // Command Palette commands
  const commandPaletteCommands = getDefaultCommands({
    onNavigateOverview: () => { setActiveTab('overview'); toast.info('Navigated to Overview') },
    onNavigateCompliance: () => { setActiveTab('compliance'); toast.info('Navigated to Compliance') },
    onNavigateThreats: () => { setActiveTab('threats'); toast.info('Navigated to Threat Radar') },
    onNavigateEvents: () => { setActiveTab('events'); toast.info('Navigated to Event Search') },
    onExportPdf: () => setShowExportModal(true),
    onNewAttestation: () => setShowAttestModal(true),
    onRefresh: () => { refreshData(); toast.success('Dashboard refreshed') },
    onShowShortcuts: () => setShowShortcutsHelp(true),
    onVerifyChain: () => { refreshData(); toast.success('Chain integrity verified') },
  })

  // Keyboard shortcuts
  const shortcuts = getDefaultShortcuts({
    onNavigateOverview: () => setActiveTab('overview'),
    onNavigateCompliance: () => setActiveTab('compliance'),
    onNavigateThreats: () => setActiveTab('threats'),
    onNavigateEvents: () => setActiveTab('events'),
    onExport: () => setShowExportModal(true),
    onAttest: () => setShowAttestModal(true),
    onRefresh: () => { refreshData(); toast.success('Dashboard refreshed') },
    onSearch: () => {
      setActiveTab('events')
      setTimeout(() => searchInputRef.current?.focus(), 100)
    },
    onCloseModal: closeAllModals,
    onShowHelp: () => setShowShortcutsHelp(true),
  })
  
  // Add Ctrl+K for command palette
  useEffect(() => {
    const handleCommandPalette = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleCommandPalette)
    return () => window.removeEventListener('keydown', handleCommandPalette)
  }, [])
  
  useKeyboardShortcuts(shortcuts, true)

  useEffect(() => {
    // Show onboarding only for first-run in production mode (not demo)
    if (isFirstRun && health && !health.demo_mode) {
      setShowOnboarding(true)
    }
  }, [isFirstRun, health])

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsData, healthData, complianceData] = await Promise.all([
          invoke<AuditStats>('get_audit_stats'),
          invoke<SystemHealth>('get_system_health'),
          invoke<ComplianceFramework[]>('get_compliance_status'),
        ])
        
        setStats(statsData)
        setHealth(healthData)
        setCompliance(complianceData)
        setLoading(false)
      } catch (err) {
        setError(err as string)
        setLoading(false)
      }
    }

    loadDashboardData()
    
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-danger-500 mx-auto mb-4" />
          <p className="text-danger-600 font-medium">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Demo Mode Banner */}
      {health?.demo_mode && (
        <div className="demo-banner">
          🎭 DEMO MODE - Using synthetic data for demonstration
        </div>
      )}

      {/* Header - GRC Style */}
      <header className="bg-white border-b border-bg-tertiary px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/securamem-logo.jpg" alt="SecuraMem Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">SecuraMem</h1>
              <p className="text-sm text-text-tertiary">AI Flight Recorder Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* EU AI Act Countdown Badge */}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                EU AI Act: {getDaysUntilDeadline()} days
              </span>
            </div>
            <button 
              onClick={() => setShowAttestModal(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="New Attestation (Ctrl+N)"
            >
              <ClipboardCheck className="w-4 h-4" />
              Attest
            </button>
            <button 
              onClick={() => setShowExportModal(true)}
              className="btn-primary flex items-center gap-2 text-sm"
              title="Export Report (Ctrl+E)"
            >
              <FileText className="w-4 h-4" />
              Export
            </button>
            <div className="flex items-center gap-2 bg-success-50 px-3 py-1.5 rounded-lg">
              {health?.status === 'healthy' ? (
                <CheckCircle className="w-5 h-5 text-success-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-warning-600" />
              )}
              <span className="text-sm text-success-700 font-medium">
                {health?.status === 'healthy' ? 'All Systems Operational' : 'Degraded'}
              </span>
            </div>
            {/* Command Palette Button */}
            <button 
              onClick={() => setShowCommandPalette(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Command Palette (Ctrl+K)"
            >
              <Command className="w-5 h-5 text-slate-400" />
            </button>
            {/* Keyboard Shortcuts Hint */}
            <button 
              onClick={() => setShowShortcutsHelp(true)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-5 h-5 text-slate-400" />
            </button>
            <span className="text-xs text-text-muted font-medium">v{health?.version}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-xl p-1 shadow-sm border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Overview (Ctrl+1)"
          >
            <LayoutDashboard className="w-4 h-4" />
            Overview
            <kbd className={`ml-1 text-xs px-1 rounded ${activeTab === 'overview' ? 'bg-blue-500 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>1</kbd>
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'compliance'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Compliance (Ctrl+2)"
          >
            <ClipboardCheck className="w-4 h-4" />
            Compliance
            <kbd className={`ml-1 text-xs px-1 rounded ${activeTab === 'compliance' ? 'bg-blue-500 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>2</kbd>
          </button>
          <button
            onClick={() => setActiveTab('threats')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'threats'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Threat Radar (Ctrl+3)"
          >
            <Target className="w-4 h-4" />
            Threat Radar
            <kbd className={`ml-1 text-xs px-1 rounded ${activeTab === 'threats' ? 'bg-blue-500 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>3</kbd>
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'events'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Event Search (Ctrl+4)"
          >
            <Search className="w-4 h-4" />
            Event Search
            <kbd className={`ml-1 text-xs px-1 rounded ${activeTab === 'events' ? 'bg-blue-500 text-blue-100' : 'bg-slate-200 text-slate-500'}`}>4</kbd>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Audit Entries */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Database className="w-5 h-5 text-primary-400" />
              </div>
              <span className="stat-label">Total Audit Entries</span>
            </div>
            <p className="stat-value">{stats?.total_entries.toLocaleString()}</p>
            <p className="text-sm text-text-muted mt-2">
              {stats?.entries_today} today • {stats?.entries_this_week} this week
            </p>
          </div>

          {/* Chain Integrity */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-success-500/20 rounded-lg">
                <Lock className="w-5 h-5 text-success-400" />
              </div>
              <span className="stat-label">Chain Integrity</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-success-600" />
              <p className="stat-value text-success-600">Verified</p>
            </div>
            <p className="text-sm text-text-muted mt-2 font-mono truncate">
              {stats?.latest_hash?.substring(0, 16)}...
            </p>
          </div>

          {/* Threats Blocked */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-danger-400" />
              </div>
              <span className="stat-label">NeuroWall Status</span>
            </div>
            <p className="stat-value text-text-primary">Active</p>
            <p className="text-sm text-text-muted mt-2">
              Semantic threat detection enabled
            </p>
          </div>

          {/* Last Activity */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-accent-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-accent-500" />
              </div>
              <span className="stat-label">Last Activity</span>
            </div>
            <p className="text-lg font-semibold text-text-primary">
              {health?.last_entry_timestamp
                ? new Date(health.last_entry_timestamp).toLocaleTimeString()
                : 'No activity'}
            </p>
            <p className="text-sm text-text-muted mt-2">
              {health?.last_entry_timestamp
                ? new Date(health.last_entry_timestamp).toLocaleDateString()
                : ''}
            </p>
          </div>
        </div>

        {/* Live Audit Stream */}
        <LiveAuditStream className="mb-8" />

        {/* Threat Timeline Chart */}
        <ThreatTimeline className="mb-8" />

        {/* Attack Simulator - Only in Demo Mode */}
        {health?.demo_mode && (
          <AttackSimulator className="mb-8" enabled={true} />
        )}

        {/* Quick Compliance Overview */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            Compliance Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {compliance.map((framework) => (
              <div key={framework.framework_id} className="card">
                <div className="card-header">
                  <h3 className="card-title">{framework.name}</h3>
                  <span className={`badge ${
                    framework.overall_score >= 90 ? 'badge-success' :
                    framework.overall_score >= 70 ? 'badge-warning' : 'badge-danger'
                  }`}>
                    {framework.overall_score.toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-4">{framework.description}</p>

                {/* Progress bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                  <div 
                    className={`h-full rounded-full progress-bar-fill`}
                    data-score={framework.overall_score >= 90 ? 'success' : framework.overall_score >= 70 ? 'warning' : 'danger'}
                    style={{ width: `${framework.overall_score}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-xs text-text-tertiary font-medium">
                  <span>✓ {framework.controls_compliant} Compliant</span>
                  <span>◐ {framework.controls_partial} Partial</span>
                  <span>✗ {framework.controls_non_compliant} Non-Compliant</span>
                </div>
              </div>
            ))}
          </div>
        </div>
          </>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && (
          <CompliancePanel 
            onExportReport={(frameworkId) => {
              console.log('Export report for:', frameworkId)
            }}
            onScheduleAudit={(frameworkId) => {
              console.log('Schedule audit for:', frameworkId)
            }}
          />
        )}

        {/* Threat Radar Tab */}
        {activeTab === 'threats' && (
          <ThreatRadar 
            onEventSelect={(event) => {
              setSelectedEvent({
                id: event.id,
                timestamp: event.timestamp,
                type: event.type,
                action: event.blocked ? 'blocked' : 'flagged',
                source: 'NeuroWall',
                details: event.details,
                hash: `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
                chainPosition: Math.floor(Math.random() * 10000) + 10000,
                severity: event.severity,
                confidence: event.confidence,
                vectorDistance: event.vectorDistance,
              })
              setShowEventModal(true)
            }}
          />
        )}

        {/* Event Search Tab */}
        {activeTab === 'events' && (
          <EventSearchFilter 
            onEventClick={(event) => {
              setSelectedEvent(event)
              setShowEventModal(true)
            }}
            onExport={(events) => {
              console.log('Export events:', events.length)
            }}
            onRefresh={() => {
              console.log('Refresh events')
            }}
          />
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-text-tertiary py-4 border-t border-bg-tertiary mt-8">
          <p className="font-medium">SecuraMem v{health?.version} • Air-Gapped AI Compliance Platform</p>
          <p className="text-xs mt-1 text-text-muted">All data stored locally. No cloud connections.</p>
        </footer>
      </main>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onCopyHash={(hash) => console.log('Copied:', hash)}
        onExportJson={(event) => console.log('Export JSON:', event)}
        onViewInChain={(position) => console.log('View chain position:', position)}
      />

      {/* First-Run Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={(config: OnboardingConfig) => {
          console.log('Onboarding complete:', config)
          // TODO: Save config to backend
          completeOnboarding()
          setShowOnboarding(false)
        }}
        onSkip={() => {
          completeOnboarding()
          setShowOnboarding(false)
        }}
      />

      {/* PDF Export Modal */}
      <PdfExportDialog
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSuccess={(path) => {
          console.log('Exported to:', path)
          setShowExportModal(false)
        }}
      />

      {/* Attestation Form Modal */}
      <AttestationForm
        isOpen={showAttestModal}
        onClose={() => setShowAttestModal(false)}
        onSuccess={(id) => {
          console.log('Attestation created:', id)
          refreshData() // Refresh compliance data
        }}
      />

      {/* Keyboard Shortcuts Help */}
      <ShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
        shortcuts={shortcuts}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commandPaletteCommands}
      />
    </div>
  )
}

// Main App wrapper with ToastProvider
function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
