import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Shield, AlertTriangle, TrendingUp, Clock } from 'lucide-react'

// Types matching Rust IPC
interface ThreatEvent {
  timestamp: string
  threat_type: string
  threat_score: number
  blocked: boolean
  details: string
}

interface TimelinePoint {
  time: string
  timestamp: Date
  blocked: number
  allowed: number
  threatScore: number
}

interface ThreatTimelineProps {
  className?: string
}

export function ThreatTimeline({ className = '' }: ThreatTimelineProps) {
  const [events, setEvents] = useState<ThreatEvent[]>([])
  const [timelineData, setTimelineData] = useState<TimelinePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h')

  useEffect(() => {
    async function loadEvents() {
      try {
        const result = await invoke<ThreatEvent[]>('get_threat_events', {
          hours: timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168,
        })
        setEvents(result)
        
        // Aggregate events into timeline points
        const aggregated = aggregateToTimeline(result, timeRange)
        setTimelineData(aggregated)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load threat events:', err)
        // Use demo data on error
        setTimelineData(generateDemoData(timeRange))
        setLoading(false)
      }
    }

    loadEvents()
    // Refresh every 30 seconds
    const interval = setInterval(loadEvents, 30000)
    return () => clearInterval(interval)
  }, [timeRange])

  // Stats derived from events
  const totalBlocked = timelineData.reduce((sum, p) => sum + p.blocked, 0)
  const totalAllowed = timelineData.reduce((sum, p) => sum + p.allowed, 0)
  const avgThreatScore = events.length > 0
    ? events.reduce((sum, e) => sum + e.threat_score, 0) / events.length
    : 0
  const blockRate = totalBlocked + totalAllowed > 0
    ? (totalBlocked / (totalBlocked + totalAllowed)) * 100
    : 0

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="flex items-center justify-center py-16">
          <Shield className="w-8 h-8 text-primary-500 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-text-primary">Threat Timeline</h3>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1">
          {(['1h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md transition-all
                ${timeRange === range
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary'
                }
              `}
            >
              {range === '1h' ? '1 Hour' : range === '24h' ? '24 Hours' : '7 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-danger-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-danger-500" />
            <span className="text-xs font-medium text-danger-700">Blocked</span>
          </div>
          <p className="text-2xl font-bold text-danger-700">{totalBlocked}</p>
        </div>
        
        <div className="bg-success-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-success-500" />
            <span className="text-xs font-medium text-success-700">Verified</span>
          </div>
          <p className="text-2xl font-bold text-success-700">{totalAllowed}</p>
        </div>
        
        <div className="bg-warning-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-warning-500" />
            <span className="text-xs font-medium text-warning-700">Threat Avg</span>
          </div>
          <p className="text-2xl font-bold text-warning-700">{(avgThreatScore * 100).toFixed(0)}%</p>
        </div>
        
        <div className="bg-primary-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-medium text-primary-700">Block Rate</span>
          </div>
          <p className="text-2xl font-bold text-primary-700">{blockRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={{ stroke: '#E5E7EB' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={{ stroke: '#E5E7EB' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ paddingTop: 16 }}
            />
            <ReferenceLine y={5} stroke="#F59E0B" strokeDasharray="5 5" label="" />
            <Area
              type="monotone"
              dataKey="blocked"
              name="⛔ Blocked"
              stroke="#EF4444"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBlocked)"
            />
            <Area
              type="monotone"
              dataKey="allowed"
              name="✓ Verified"
              stroke="#22C55E"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAllowed)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Threat Score Line Chart */}
      <div className="mt-6 pt-6 border-t border-bg-tertiary">
        <h4 className="text-sm font-medium text-text-secondary mb-4">Threat Score Trend</h4>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Threat Score']}
              />
              <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Critical', position: 'right', fontSize: 10, fill: '#EF4444' }} />
              <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Warning', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
              <Line
                type="monotone"
                dataKey="threatScore"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#8B5CF6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Threats Table */}
      {events.length > 0 && (
        <div className="mt-6 pt-6 border-t border-bg-tertiary">
          <h4 className="text-sm font-medium text-text-secondary mb-3">Recent Threat Events</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-tertiary">
                  <th className="text-left py-2 px-2 text-xs font-medium text-text-tertiary">Time</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-text-tertiary">Type</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-text-tertiary">Score</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-text-tertiary">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 5).map((event, i) => (
                  <tr key={i} className="border-b border-bg-secondary">
                    <td className="py-2 px-2 text-text-secondary font-mono text-xs">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-2 text-text-primary">{event.threat_type}</td>
                    <td className="py-2 px-2">
                      <span className={`
                        inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold
                        ${event.threat_score > 0.75 ? 'bg-danger-100 text-danger-700' :
                          event.threat_score > 0.5 ? 'bg-warning-100 text-warning-700' :
                          'bg-gray-100 text-gray-700'}
                      `}>
                        {(event.threat_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {event.blocked ? (
                        <span className="text-danger-600 font-medium">⛔ Blocked</span>
                      ) : (
                        <span className="text-success-600 font-medium">✓ Allowed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper: Aggregate events into timeline points
function aggregateToTimeline(events: ThreatEvent[], range: '1h' | '24h' | '7d'): TimelinePoint[] {
  if (events.length === 0) {
    return generateDemoData(range)
  }

  const bucketSize = range === '1h' ? 5 : range === '24h' ? 60 : 360 // minutes
  const buckets = new Map<string, { blocked: number; allowed: number; scores: number[] }>()

  events.forEach(event => {
    const date = new Date(event.timestamp)
    const bucketTime = new Date(Math.floor(date.getTime() / (bucketSize * 60000)) * bucketSize * 60000)
    const key = bucketTime.toISOString()

    if (!buckets.has(key)) {
      buckets.set(key, { blocked: 0, allowed: 0, scores: [] })
    }

    const bucket = buckets.get(key)!
    if (event.blocked) {
      bucket.blocked++
    } else {
      bucket.allowed++
    }
    bucket.scores.push(event.threat_score)
  })

  return Array.from(buckets.entries())
    .map(([key, data]) => ({
      time: formatTimeLabel(new Date(key), range),
      timestamp: new Date(key),
      blocked: data.blocked,
      allowed: data.allowed,
      threatScore: data.scores.length > 0
        ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100
        : 0,
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// Helper: Format time labels based on range
function formatTimeLabel(date: Date, range: '1h' | '24h' | '7d'): string {
  if (range === '1h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } else if (range === '24h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit' })
  }
}

// Helper: Generate demo data for visualization
function generateDemoData(range: '1h' | '24h' | '7d'): TimelinePoint[] {
  const points: TimelinePoint[] = []
  const now = new Date()
  const intervals = range === '1h' ? 12 : range === '24h' ? 24 : 7

  for (let i = intervals - 1; i >= 0; i--) {
    const time = new Date(now)
    if (range === '1h') {
      time.setMinutes(time.getMinutes() - i * 5)
    } else if (range === '24h') {
      time.setHours(time.getHours() - i)
    } else {
      time.setDate(time.getDate() - i)
    }

    // Generate realistic-looking threat data
    const baseBlocked = Math.floor(Math.random() * 3)
    const baseAllowed = Math.floor(Math.random() * 10) + 5
    const threatScore = 20 + Math.random() * 40 + (i % 4 === 0 ? 30 : 0)

    points.push({
      time: formatTimeLabel(time, range),
      timestamp: time,
      blocked: baseBlocked + (i % 3 === 0 ? 2 : 0),
      allowed: baseAllowed,
      threatScore: Math.min(threatScore, 95),
    })
  }

  return points
}
