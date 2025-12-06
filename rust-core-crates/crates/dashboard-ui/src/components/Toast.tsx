import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newToast: Toast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])

    // Auto-remove after duration (default 5s)
    const duration = toast.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }, [removeToast])

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message })
  }, [addToast])

  const error = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message, duration: 8000 }) // Errors stay longer
  }, [addToast])

  const warning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message, duration: 6000 })
  }, [addToast])

  const info = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

// Toast container component
interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div 
      className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-md"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  )
}

// Individual toast item
interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 200) // Wait for exit animation
  }

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  }

  const backgrounds = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  }

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm
        ${backgrounds[toast.type]}
        ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
        transition-all duration-200
      `}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-slate-600 mt-0.5">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-2"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 hover:bg-slate-200/50 rounded-lg transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  )
}

// Animation keyframes (add to index.css)
export const toastAnimationStyles = `
@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slide-out-right {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}

.animate-slide-out-right {
  animation: slide-out-right 0.2s ease-in;
}
`

export default ToastProvider
