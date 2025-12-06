import React, { useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { 
  Target, AlertTriangle, Shield, Zap, 
  Eye, ChevronDown, Info
} from 'lucide-react';

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  type: 'injection' | 'jailbreak' | 'extraction' | 'manipulation' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
  confidence: number;
  details: string;
  vectorDistance: number;
}

interface ThreatRadarProps {
  events?: ThreatEvent[];
  timeRange?: '1h' | '24h' | '7d' | '30d';
  onEventSelect?: (event: ThreatEvent) => void;
}

// Generate sample threat data
const generateSampleThreats = (count: number, hoursBack: number): ThreatEvent[] => {
  const types: ThreatEvent['type'][] = ['injection', 'jailbreak', 'extraction', 'manipulation', 'other'];
  const severities: ThreatEvent['severity'][] = ['low', 'medium', 'high', 'critical'];
  
  return Array.from({ length: count }, (_, i) => {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    return {
      id: `threat-${i}`,
      timestamp: new Date(Date.now() - Math.random() * hoursBack * 60 * 60 * 1000),
      type: types[Math.floor(Math.random() * types.length)],
      severity,
      blocked: Math.random() > 0.15,
      confidence: 0.7 + Math.random() * 0.3,
      details: `${types[Math.floor(Math.random() * types.length)]} attempt detected`,
      vectorDistance: 0.5 + Math.random() * 0.5,
    };
  });
};

const severityColors = {
  low: '#0A9D57',      // success green
  medium: '#FFA500',   // warning amber
  high: '#E53935',     // danger red
  critical: '#7C3AED', // accent purple
};

const severityScore = {
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1.0,
};

const typeIcons = {
  injection: Zap,
  jailbreak: Shield,
  extraction: Eye,
  manipulation: AlertTriangle,
  other: Info,
};

export const ThreatRadar: React.FC<ThreatRadarProps> = ({
  events: propEvents,
  timeRange: initialTimeRange = '24h',
  onEventSelect,
}) => {
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [viewMode, setViewMode] = useState<'scatter' | 'radar'>('scatter');
  const [selectedEvent, setSelectedEvent] = useState<ThreatEvent | null>(null);

  const hoursMap = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 };
  
  const events = useMemo(() => {
    if (propEvents && propEvents.length > 0) return propEvents;
    return generateSampleThreats(50, hoursMap[timeRange]);
  }, [propEvents, timeRange]);

  // Filter events by time range
  const filteredEvents = useMemo(() => {
    const cutoff = new Date(Date.now() - hoursMap[timeRange] * 60 * 60 * 1000);
    return events.filter(e => e.timestamp >= cutoff);
  }, [events, timeRange]);

  // Scatter plot data
  const scatterData = useMemo(() => {
    return filteredEvents.map(event => ({
      x: event.timestamp.getTime(),
      y: severityScore[event.severity],
      z: event.vectorDistance * 100,
      event,
    }));
  }, [filteredEvents]);

  // Radar chart data (category breakdown)
  const radarData = useMemo(() => {
    const categories: ThreatEvent['type'][] = ['injection', 'jailbreak', 'extraction', 'manipulation', 'other'];
    return categories.map(cat => {
      const catEvents = filteredEvents.filter(e => e.type === cat);
      const blocked = catEvents.filter(e => e.blocked).length;
      const total = catEvents.length;
      return {
        category: cat.charAt(0).toUpperCase() + cat.slice(1),
        total,
        blocked,
        detected: total - blocked,
      };
    });
  }, [filteredEvents]);

  // Stats
  const stats = useMemo(() => {
    const blocked = filteredEvents.filter(e => e.blocked).length;
    const critical = filteredEvents.filter(e => e.severity === 'critical').length;
    return {
      total: filteredEvents.length,
      blocked,
      blockRate: filteredEvents.length > 0 ? (blocked / filteredEvents.length * 100).toFixed(1) : '0',
      critical,
    };
  }, [filteredEvents]);

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '1h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (timeRange === '24h') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const event: ThreatEvent = data.event;
    const TypeIcon = typeIcons[event.type];
    
    return (
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-4 max-w-xs">
        <div className="flex items-center gap-2 mb-2">
          <TypeIcon className="w-4 h-4 text-slate-600" />
          <span className="font-medium text-slate-900 capitalize">{event.type}</span>
          <span className={`
            ml-auto px-2 py-0.5 rounded text-xs font-medium
            ${event.blocked ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
          `}>
            {event.blocked ? 'BLOCKED' : 'DETECTED'}
          </span>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Severity</span>
            <span className={`font-medium capitalize`} style={{ color: severityColors[event.severity] }}>
              {event.severity}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Confidence</span>
            <span className="text-slate-900">{(event.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Vector Distance</span>
            <span className="text-slate-900">{event.vectorDistance.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Time</span>
            <span className="text-slate-900">
              {event.timestamp.toLocaleString([], { 
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500 border-t pt-2">{event.details}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Threat Radar</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('scatter')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'scatter' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('radar')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'radar' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Categories
              </button>
            </div>
            
            {/* Time Range */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                className="appearance-none bg-slate-100 border-0 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-2 bg-slate-50 rounded-lg">
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Threats</div>
          </div>
          <div className="text-center p-2 bg-emerald-50 rounded-lg">
            <div className="text-xl font-bold text-emerald-600">{stats.blocked}</div>
            <div className="text-xs text-emerald-600">Blocked</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-xl font-bold text-blue-600">{stats.blockRate}%</div>
            <div className="text-xs text-blue-600">Block Rate</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <div className="text-xl font-bold text-purple-600">{stats.critical}</div>
            <div className="text-xs text-purple-600">Critical</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {viewMode === 'scatter' ? (
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <XAxis
                type="number"
                dataKey="x"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatXAxis}
                tick={{ fill: '#64748B', fontSize: 12 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 1]}
                tickFormatter={(v) => {
                  if (v === 0.25) return 'Low';
                  if (v === 0.5) return 'Med';
                  if (v === 0.75) return 'High';
                  if (v === 1) return 'Crit';
                  return '';
                }}
                tick={{ fill: '#64748B', fontSize: 12 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={{ stroke: '#E2E8F0' }}
              />
              <ZAxis type="number" dataKey="z" range={[50, 400]} />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={scatterData} onClick={(data) => {
                setSelectedEvent(data.event);
                onEventSelect?.(data.event);
              }}>
                {scatterData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.event.blocked ? severityColors[entry.event.severity] : '#E53935'}
                    fillOpacity={entry.event.blocked ? 0.8 : 0.4}
                    stroke={entry.event.blocked ? severityColors[entry.event.severity] : '#E53935'}
                    strokeWidth={entry.event.blocked ? 0 : 2}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#E2E8F0" />
              <PolarAngleAxis 
                dataKey="category" 
                tick={{ fill: '#64748B', fontSize: 12 }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 'auto']}
                tick={{ fill: '#64748B', fontSize: 10 }}
              />
              <Radar
                name="Blocked"
                dataKey="blocked"
                stroke="#0A9D57"
                fill="#0A9D57"
                fillOpacity={0.5}
              />
              <Radar
                name="Detected"
                dataKey="detected"
                stroke="#E53935"
                fill="#E53935"
                fillOpacity={0.3}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-center gap-6 text-xs">
          {Object.entries(severityColors).map(([severity, color]) => (
            <div key={severity} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-600 capitalize">{severity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Event Details */}
      {selectedEvent && (
        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {React.createElement(typeIcons[selectedEvent.type], { 
                className: 'w-5 h-5 text-slate-600' 
              })}
              <div>
                <div className="font-medium text-slate-900 capitalize">
                  {selectedEvent.type} - {selectedEvent.severity}
                </div>
                <div className="text-sm text-slate-500">{selectedEvent.details}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatRadar;
