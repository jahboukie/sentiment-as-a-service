import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Zap,
  Shield,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Skull,
  CheckCircle,
} from 'lucide-react'

interface LiveAttackEvent {
  id: number
  timestamp: string
  actor: string
  attack_type: string
  prompt: string
  similarity_score: number
  blocked: boolean
  receipt_hash: string
}

interface AttackSimulatorProps {
  className?: string
  enabled?: boolean
}

export function AttackSimulator({ className = '', enabled = true }: AttackSimulatorProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [attacks, setAttacks] = useState<LiveAttackEvent[]>([])
  const [stats, setStats] = useState({ total: 0, blocked: 0 })

  async function simulateAttack() {
    try {
      const attack = await invoke<LiveAttackEvent>('simulate_attack')
      setAttacks((prev) => [attack, ...prev.slice(0, 9)]) // Keep last 10
      setStats((prev) => ({
        total: prev.total + 1,
        blocked: prev.blocked + (attack.blocked ? 1 : 0),
      }))
    } catch (err) {
      console.error('Simulation failed:', err)
    }
  }

  async function startSimulation() {
    setIsRunning(true)
    // Run simulation immediately
    await simulateAttack()
  }

  function stopSimulation() {
    setIsRunning(false)
  }

  function resetSimulation() {
    setAttacks([])
    setStats({ total: 0, blocked: 0 })
    setIsRunning(false)
  }

  // Auto-simulate when running
  useState(() => {
    if (isRunning) {
      const interval = setInterval(simulateAttack, 3000)
      return () => clearInterval(interval)
    }
  })

  if (!enabled) {
    return null
  }

  return (
    <div className={`card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-danger-100 rounded-lg flex items-center justify-center">
            <Skull className="w-5 h-5 text-danger-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Attack Simulator</h3>
            <p className="text-xs text-text-tertiary">Demo: Prompt Injection Defense</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={resetSimulation}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-lg transition-colors"
            title="Reset simulation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {isRunning ? (
            <button
              onClick={stopSimulation}
              className="flex items-center gap-2 px-3 py-1.5 bg-warning-100 text-warning-700 rounded-lg text-sm font-medium hover:bg-warning-200 transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          ) : (
            <button
              onClick={startSimulation}
              className="flex items-center gap-2 px-3 py-1.5 bg-danger-100 text-danger-700 rounded-lg text-sm font-medium hover:bg-danger-200 transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Attack
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-text-primary">{stats.total}</p>
          <p className="text-xs text-text-tertiary">Attacks</p>
        </div>
        <div className="bg-success-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success-700">{stats.blocked}</p>
          <p className="text-xs text-success-600">Blocked</p>
        </div>
        <div className="bg-primary-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary-700">
            {stats.total > 0 ? ((stats.blocked / stats.total) * 100).toFixed(0) : 0}%
          </p>
          <p className="text-xs text-primary-600">Block Rate</p>
        </div>
      </div>

      {/* Attack Feed */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {attacks.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Click "Run Attack" to simulate prompt injection</p>
            <p className="text-xs mt-1">Watch NeuroWall detect and block threats in real-time</p>
          </div>
        ) : (
          attacks.map((attack, index) => (
            <div
              key={attack.id}
              className={`
                relative p-4 rounded-lg border transition-all
                ${attack.blocked
                  ? 'bg-danger-50 border-danger-200'
                  : 'bg-warning-50 border-warning-200'
                }
                ${index === 0 ? 'ring-2 ring-danger-300 animate-pulse' : ''}
              `}
              style={{
                animation: index === 0 ? 'slideInFromRight 300ms ease-out' : undefined
              }}
            >
              {/* Status indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-danger-500" />

              <div className="ml-2">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {attack.blocked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-danger-100 text-danger-700 rounded text-xs font-semibold">
                        <Shield className="w-3 h-3" />
                        BLOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-100 text-warning-700 rounded text-xs font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        WARNING
                      </span>
                    )}
                    <span className="text-xs text-text-tertiary">{attack.attack_type}</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    {new Date(attack.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Prompt */}
                <p className="text-sm text-text-secondary font-mono bg-white/50 p-2 rounded mb-2 line-clamp-2">
                  {attack.prompt}
                </p>

                {/* Details */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Actor: {attack.actor}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${
                      attack.similarity_score > 0.9 ? 'text-danger-600' :
                      attack.similarity_score > 0.8 ? 'text-warning-600' :
                      'text-gray-600'
                    }`}>
                      {(attack.similarity_score * 100).toFixed(1)}% match
                    </span>
                  </div>
                </div>

                {/* Hash */}
                <div className="mt-2 pt-2 border-t border-white/50 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-success-600" />
                  <code className="text-[10px] font-mono text-text-muted">
                    {attack.receipt_hash.substring(0, 32)}...
                  </code>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-bg-tertiary">
        <p className="text-xs text-text-muted text-center">
          🎭 This is a simulation using synthetic attack patterns.
          Real attacks would trigger identical logging and blocking behavior.
        </p>
      </div>
    </div>
  )
}

// Animation keyframes
const style = document.createElement('style')
style.textContent = `
  @keyframes slideInFromRight {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`
document.head.appendChild(style)
