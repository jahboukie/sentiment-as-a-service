// Loading skeleton components for premium UI experience
import type { CSSProperties } from 'react'

// Base skeleton with shimmer animation
interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] rounded ${className}`}
      style={{ animation: 'shimmer 1.5s infinite', ...style }}
    />
  )
}

// Stat card skeleton (for KPI cards)
export function StatCardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-20 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// Audit entry skeleton (for live stream)
export function AuditEntrySkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 border-b border-slate-100">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}

// Compliance framework skeleton
export function ComplianceCardSkeleton() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full mb-4" />
      <Skeleton className="h-2 w-full rounded-full mb-3" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

// Chart skeleton
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <div 
        className="relative bg-slate-50 rounded-lg overflow-hidden"
        style={{ height }}
      >
        {/* Fake chart bars */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-4 pb-4 gap-2">
          {[40, 65, 45, 80, 55, 70, 35, 90, 60, 75, 50, 85].map((h, i) => (
            <Skeleton 
              key={i} 
              className="w-full"
              style={{ height: `${h}%`, minWidth: 8 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Full dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Live Stream */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <AuditEntrySkeleton />
        <AuditEntrySkeleton />
        <AuditEntrySkeleton />
        <AuditEntrySkeleton />
        <AuditEntrySkeleton />
      </div>

      {/* Chart */}
      <ChartSkeleton height={250} />

      {/* Compliance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ComplianceCardSkeleton />
        <ComplianceCardSkeleton />
        <ComplianceCardSkeleton />
      </div>
    </div>
  )
}

// Compliance panel skeleton
export function CompliancePanelSkeleton() {
  return (
    <div className="space-y-6">
      {/* Framework tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg flex-shrink-0" />
        ))}
      </div>

      {/* Framework header */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-16 w-16 rounded-full" />
        </div>

        {/* Controls list */}
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Threat radar skeleton
export function ThreatRadarSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Main chart area */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="h-8 w-12 rounded-lg" />
          </div>
        </div>
        <Skeleton className="w-full h-[300px] rounded-lg" />
      </div>

      {/* Threat breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <Skeleton className="h-5 w-40 mb-4" />
          <Skeleton className="w-full h-40 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// CSS animation (add to index.css)
export const skeletonAnimationStyles = `
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`

export default Skeleton
