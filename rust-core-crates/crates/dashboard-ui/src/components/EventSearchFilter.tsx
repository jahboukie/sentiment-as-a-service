import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, X, Calendar, ChevronDown, 
  Shield, AlertTriangle, CheckCircle2, Clock,
  Download, RefreshCw
} from 'lucide-react';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: 'prompt' | 'response' | 'system' | 'attestation';
  action: 'verified' | 'blocked' | 'flagged' | 'attested';
  source: string;
  details: string;
  hash: string;
  chainPosition: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface EventSearchFilterProps {
  events?: AuditEvent[];
  onEventClick?: (event: AuditEvent) => void;
  onExport?: (filteredEvents: AuditEvent[]) => void;
  onRefresh?: () => void;
}

// Generate sample events
const generateSampleEvents = (count: number): AuditEvent[] => {
  const types: AuditEvent['type'][] = ['prompt', 'response', 'system', 'attestation'];
  const actions: AuditEvent['action'][] = ['verified', 'blocked', 'flagged', 'attested'];
  const severities: AuditEvent['severity'][] = ['low', 'medium', 'high', 'critical'];
  const sources = ['GPT-4', 'Claude-3', 'Llama-3', 'Internal-API', 'Admin-Console'];
  
  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const action = type === 'attestation' ? 'attested' : actions[Math.floor(Math.random() * 3)];
    return {
      id: `evt-${(1000 + i).toString(16)}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      type,
      action,
      source: sources[Math.floor(Math.random() * sources.length)],
      details: `${type} ${action} - ${['User query processed', 'Model response logged', 'System checkpoint', 'Compliance attestation'][types.indexOf(type)]}`,
      hash: `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      chainPosition: 12000 + i,
      severity: action === 'blocked' || action === 'flagged' 
        ? severities[Math.floor(Math.random() * severities.length)]
        : undefined,
    };
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

const actionConfig = {
  verified: {
    icon: CheckCircle2,
    label: 'Verified',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
  },
  blocked: {
    icon: Shield,
    label: 'Blocked',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
  },
  flagged: {
    icon: AlertTriangle,
    label: 'Flagged',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
  },
  attested: {
    icon: CheckCircle2,
    label: 'Attested',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
};

const typeLabels = {
  prompt: 'Prompt',
  response: 'Response',
  system: 'System',
  attestation: 'Attestation',
};

export const EventSearchFilter: React.FC<EventSearchFilterProps> = ({
  events: propEvents,
  onEventClick,
  onExport,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    types: [] as AuditEvent['type'][],
    actions: [] as AuditEvent['action'][],
    dateRange: 'all' as 'all' | '1h' | '24h' | '7d' | '30d',
    source: '',
  });

  const events = useMemo(() => {
    if (propEvents && propEvents.length > 0) return propEvents;
    return generateSampleEvents(100);
  }, [propEvents]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.details.toLowerCase().includes(query) ||
        e.hash.toLowerCase().includes(query) ||
        e.source.toLowerCase().includes(query) ||
        e.id.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filters.types.length > 0) {
      result = result.filter(e => filters.types.includes(e.type));
    }

    // Action filter
    if (filters.actions.length > 0) {
      result = result.filter(e => filters.actions.includes(e.action));
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const hoursMap = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 };
      const cutoff = new Date(Date.now() - hoursMap[filters.dateRange] * 60 * 60 * 1000);
      result = result.filter(e => e.timestamp >= cutoff);
    }

    // Source filter
    if (filters.source) {
      result = result.filter(e => e.source === filters.source);
    }

    return result;
  }, [events, searchQuery, filters]);

  const uniqueSources = useMemo(() => {
    return [...new Set(events.map(e => e.source))].sort();
  }, [events]);

  const toggleTypeFilter = (type: AuditEvent['type']) => {
    setFilters(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type],
    }));
  };

  const toggleActionFilter = (action: AuditEvent['action']) => {
    setFilters(prev => ({
      ...prev,
      actions: prev.actions.includes(action)
        ? prev.actions.filter(a => a !== action)
        : [...prev.actions, action],
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      types: [],
      actions: [],
      dateRange: 'all',
      source: '',
    });
  };

  const hasActiveFilters = searchQuery || 
    filters.types.length > 0 || 
    filters.actions.length > 0 || 
    filters.dateRange !== 'all' || 
    filters.source;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by ID, hash, source, or details..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors
              ${showFilters 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
            `}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export */}
          <button
            onClick={() => onExport?.(filteredEvents)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
            {/* Type Filters */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Event Type
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['prompt', 'response', 'system', 'attestation'] as AuditEvent['type'][]).map(type => (
                  <button
                    key={type}
                    onClick={() => toggleTypeFilter(type)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${filters.types.includes(type)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                    `}
                  >
                    {typeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Filters */}
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Action Status
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['verified', 'blocked', 'flagged', 'attested'] as AuditEvent['action'][]).map(action => {
                  const config = actionConfig[action];
                  return (
                    <button
                      key={action}
                      onClick={() => toggleActionFilter(action)}
                      className={`
                        px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                        ${filters.actions.includes(action)
                          ? `${config.bgColor} ${config.textColor}`
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                      `}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              {/* Date Range */}
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Time Range
                </label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as typeof filters.dateRange }))}
                    className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none cursor-pointer"
                  >
                    <option value="all">All Time</option>
                    <option value="1h">Last Hour</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Source */}
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Source
                </label>
                <div className="relative mt-2">
                  <select
                    value={filters.source}
                    onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none cursor-pointer"
                  >
                    <option value="">All Sources</option>
                    {uniqueSources.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span className="text-sm text-slate-600">
          Showing <span className="font-medium text-slate-900">{filteredEvents.length}</span> of {events.length} events
        </span>
        {hasActiveFilters && (
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
            Filtered
          </span>
        )}
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Details
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Chain #
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEvents.slice(0, 50).map((event) => {
              const config = actionConfig[event.action];
              const ActionIcon = config.icon;
              
              return (
                <tr
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {event.timestamp.toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-slate-900 capitalize">
                      {typeLabels[event.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${config.bgColor} ${config.textColor}
                    `}>
                      <ActionIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-slate-600">{event.source}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-slate-600 truncate">{event.details}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-mono text-slate-500">
                      #{event.chainPosition.toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination hint */}
      {filteredEvents.length > 50 && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-center">
          <span className="text-sm text-slate-500">
            Showing first 50 results. Use filters to narrow down.
          </span>
        </div>
      )}

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className="p-12 text-center">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No events found</h3>
          <p className="text-sm text-slate-500">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
};

export default EventSearchFilter;
