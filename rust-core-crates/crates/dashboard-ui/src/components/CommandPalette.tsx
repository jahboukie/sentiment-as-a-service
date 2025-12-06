import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Search, 
  LayoutDashboard, 
  ClipboardCheck, 
  Target, 
  FileText, 
  Download,
  Shield,
  RefreshCw,
  Keyboard,
  HelpCircle,
  Calendar
} from 'lucide-react'

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  shortcut?: string
  category: 'navigation' | 'actions' | 'compliance' | 'help'
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: CommandItem[]
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands
    const query = search.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query)
    )
  }, [commands, search])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      compliance: [],
      help: [],
    }
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    compliance: 'Compliance',
    help: 'Help & Settings',
  }

  let itemIndex = -1

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-[200] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command or search..."
            className="flex-1 text-base text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
          />
          <kbd className="px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 rounded">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div 
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
              <p className="text-sm text-slate-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => {
              if (items.length === 0) return null
              return (
                <div key={category}>
                  <div className="px-4 py-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {categoryLabels[category]}
                    </span>
                  </div>
                  {items.map((cmd) => {
                    itemIndex++
                    const isSelected = itemIndex === selectedIndex
                    const currentIndex = itemIndex
                    return (
                      <button
                        key={cmd.id}
                        data-index={currentIndex}
                        onClick={() => {
                          cmd.action()
                          onClose()
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                          ${isSelected ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'}
                        `}
                      >
                        <span className={`flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{cmd.label}</p>
                          {cmd.description && (
                            <p className={`text-sm truncate ${isSelected ? 'text-blue-600/70' : 'text-slate-400'}`}>
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className={`
                            px-2 py-0.5 text-xs font-medium rounded flex-shrink-0
                            ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}
                          `}>
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-200 rounded">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 rounded">↵</kbd>
              select
            </span>
          </div>
          <span>SecuraMem Command Palette</span>
        </div>
      </div>
    </div>
  )
}

// Default commands factory
export function getDefaultCommands(handlers: {
  onNavigateOverview?: () => void
  onNavigateCompliance?: () => void
  onNavigateThreats?: () => void
  onNavigateEvents?: () => void
  onExportPdf?: () => void
  onNewAttestation?: () => void
  onRefresh?: () => void
  onShowShortcuts?: () => void
  onVerifyChain?: () => void
}): CommandItem[] {
  return [
    // Navigation
    {
      id: 'nav-overview',
      label: 'Go to Overview',
      description: 'Dashboard overview with KPIs',
      icon: <LayoutDashboard className="w-4 h-4" />,
      shortcut: 'Ctrl+1',
      category: 'navigation',
      action: handlers.onNavigateOverview || (() => {}),
    },
    {
      id: 'nav-compliance',
      label: 'Go to Compliance',
      description: 'Framework compliance status',
      icon: <ClipboardCheck className="w-4 h-4" />,
      shortcut: 'Ctrl+2',
      category: 'navigation',
      action: handlers.onNavigateCompliance || (() => {}),
    },
    {
      id: 'nav-threats',
      label: 'Go to Threat Radar',
      description: 'Security threat analysis',
      icon: <Target className="w-4 h-4" />,
      shortcut: 'Ctrl+3',
      category: 'navigation',
      action: handlers.onNavigateThreats || (() => {}),
    },
    {
      id: 'nav-events',
      label: 'Go to Event Search',
      description: 'Search audit trail',
      icon: <Search className="w-4 h-4" />,
      shortcut: 'Ctrl+4',
      category: 'navigation',
      action: handlers.onNavigateEvents || (() => {}),
    },
    // Actions
    {
      id: 'action-export',
      label: 'Export PDF Report',
      description: 'Generate court-admissible compliance report',
      icon: <Download className="w-4 h-4" />,
      shortcut: 'Ctrl+E',
      category: 'actions',
      action: handlers.onExportPdf || (() => {}),
    },
    {
      id: 'action-attest',
      label: 'New Attestation',
      description: 'Submit a compliance attestation',
      icon: <FileText className="w-4 h-4" />,
      shortcut: 'Ctrl+N',
      category: 'actions',
      action: handlers.onNewAttestation || (() => {}),
    },
    {
      id: 'action-refresh',
      label: 'Refresh Data',
      description: 'Reload all dashboard data',
      icon: <RefreshCw className="w-4 h-4" />,
      shortcut: 'Ctrl+R',
      category: 'actions',
      action: handlers.onRefresh || (() => {}),
    },
    // Compliance
    {
      id: 'compliance-eu-ai',
      label: 'EU AI Act Status',
      description: 'View EU AI Act compliance',
      icon: <Calendar className="w-4 h-4" />,
      category: 'compliance',
      action: handlers.onNavigateCompliance || (() => {}),
    },
    {
      id: 'compliance-verify',
      label: 'Verify Audit Chain',
      description: 'Cryptographic integrity check',
      icon: <Shield className="w-4 h-4" />,
      category: 'compliance',
      action: handlers.onVerifyChain || (() => {}),
    },
    // Help
    {
      id: 'help-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: <Keyboard className="w-4 h-4" />,
      shortcut: '?',
      category: 'help',
      action: handlers.onShowShortcuts || (() => {}),
    },
    {
      id: 'help-about',
      label: 'About SecuraMem',
      description: 'Version and license info',
      icon: <HelpCircle className="w-4 h-4" />,
      category: 'help',
      action: () => {}, // TODO: About modal
    },
  ]
}

export default CommandPalette
