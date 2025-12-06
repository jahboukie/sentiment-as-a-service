import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

/**
 * Hook for registering keyboard shortcuts
 * 
 * Shortcuts follow platform conventions:
 * - Ctrl+1-4: Navigate tabs
 * - Ctrl+E: Export PDF
 * - Ctrl+A: New Attestation
 * - Ctrl+F: Focus search
 * - Ctrl+R: Refresh data
 * - Escape: Close modals
 * - ?: Show help
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Default application shortcuts
 */
export function getDefaultShortcuts(handlers: {
  onNavigateOverview?: () => void;
  onNavigateCompliance?: () => void;
  onNavigateThreats?: () => void;
  onNavigateEvents?: () => void;
  onExport?: () => void;
  onAttest?: () => void;
  onRefresh?: () => void;
  onSearch?: () => void;
  onCloseModal?: () => void;
  onShowHelp?: () => void;
}): KeyboardShortcut[] {
  return [
    // Tab navigation
    {
      key: '1',
      ctrl: true,
      description: 'Go to Overview tab',
      action: handlers.onNavigateOverview || (() => {}),
    },
    {
      key: '2',
      ctrl: true,
      description: 'Go to Compliance tab',
      action: handlers.onNavigateCompliance || (() => {}),
    },
    {
      key: '3',
      ctrl: true,
      description: 'Go to Threat Radar tab',
      action: handlers.onNavigateThreats || (() => {}),
    },
    {
      key: '4',
      ctrl: true,
      description: 'Go to Event Search tab',
      action: handlers.onNavigateEvents || (() => {}),
    },
    // Actions
    {
      key: 'e',
      ctrl: true,
      description: 'Export PDF report',
      action: handlers.onExport || (() => {}),
    },
    {
      key: 'n',
      ctrl: true,
      description: 'New attestation',
      action: handlers.onAttest || (() => {}),
    },
    {
      key: 'r',
      ctrl: true,
      description: 'Refresh data',
      action: handlers.onRefresh || (() => {}),
    },
    {
      key: 'f',
      ctrl: true,
      description: 'Focus search',
      action: handlers.onSearch || (() => {}),
    },
    // Modal control
    {
      key: 'Escape',
      description: 'Close modal / Cancel',
      action: handlers.onCloseModal || (() => {}),
    },
    // Help
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      action: handlers.onShowHelp || (() => {}),
    },
  ];
}

/**
 * Keyboard shortcuts help panel component
 */
import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts,
}) => {
  if (!isOpen) return null;

  const formatKey = (shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  // Group shortcuts by category
  const navigation = shortcuts.filter(s => s.description.includes('tab') || s.description.includes('Go to'));
  const actions = shortcuts.filter(s => !s.description.includes('tab') && !s.description.includes('Go to') && s.key !== 'Escape' && s.key !== '?');
  const other = shortcuts.filter(s => s.key === 'Escape' || s.key === '?');

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <h2 id="shortcuts-title" className="text-lg font-semibold text-slate-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Navigation */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Navigation
            </h3>
            <div className="space-y-2">
              {navigation.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-600">
                    {formatKey(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Actions
            </h3>
            <div className="space-y-2">
              {actions.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-600">
                    {formatKey(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Other */}
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Other
            </h3>
            <div className="space-y-2">
              {other.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-sm font-mono text-slate-600">
                    {formatKey(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-sm text-slate-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  );
};

export default useKeyboardShortcuts;
