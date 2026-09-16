import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Bot, AlertTriangle, CheckCircle2, WifiOff,
  Search, Filter, LayoutGrid, List, RefreshCw, ChevronDown, Cpu
} from 'lucide-react';
import { MOCK_MACHINES, getMachineSummary, PLANTS } from '../data/machineMonitoringData';
import type { MachineStatus } from '../data/machineMonitoringData';
import { MachineCard } from '../components/machine-monitoring/MachineCard';
import { MachineTable } from '../components/machine-monitoring/MachineTable';

// ─── Summary Tile ─────────────────────────────────────────────────────────────

interface SummaryTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  delay?: number;
  onClick?: () => void;
  active?: boolean;
}

const SummaryTile: React.FC<SummaryTileProps> = ({
  label, value, subtext, color = '#00A9AE', icon: Icon, delay = 0, onClick, active
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    onClick={onClick}
    className={`bg-panel border rounded-[12px] p-[16px] flex flex-col gap-[8px] transition-all cursor-pointer ${
      active ? 'ring-2 ring-teal border-transparent shadow-md' : 'border-border hover:border-teal/40'
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-[10.5px] font-bold tracking-[0.6px] text-muted uppercase">{label}</span>
      <div className="w-[28px] h-[28px] rounded-[8px] flex items-center justify-center bg-slate-100">
        <Icon className="w-[14px] h-[14px]" style={{ color }} />
      </div>
    </div>
    <div className="font-head text-[28px] font-extrabold" style={{ color }}>{value}</div>
    {subtext && <div className="text-[11px] text-muted">{subtext}</div>}
  </motion.div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const MachineMonitoringPage: React.FC = () => {
  const [machines] = useState(MOCK_MACHINES);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'All'>('All');
  const [plantFilter, setPlantFilter] = useState('All Plants');
  const [issueFilter, setIssueFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const summary = useMemo(() => getMachineSummary(machines), [machines]);

  const filtered = useMemo(() => {
    return machines.filter(m => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.code.toLowerCase().includes(search.toLowerCase()) && !m.type.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'All' && m.status !== statusFilter) return false;
      if (plantFilter !== 'All Plants' && m.plant !== plantFilter) return false;
      if (issueFilter && m.activeIssues === 0) return false;
      return true;
    });
  }, [machines, search, statusFilter, plantFilter, issueFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 flex flex-col gap-6"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-6 h-6 text-teal" />
            <h1 className="font-head text-[24px] font-extrabold text-ink">Continuous Machine Monitoring</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-teal/15 text-teal border border-teal/30 text-xs font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal animate-ping" />
              LIVE TELEMETRY STREAM
            </span>
          </div>
          <p className="text-muted text-[13.5px]">
            Real-time machine health telemetry, anomaly detection & automated agentic root-cause analysis across all plant operations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-panel border border-border text-ink hover:border-teal/50 font-medium text-xs shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-border">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white text-teal shadow-sm' : 'text-muted hover:text-ink'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-md transition-all ${view === 'table' ? 'bg-white text-[#00A9AE] shadow-sm' : 'text-muted hover:text-ink'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryTile
          label="Total Fleet"
          value={summary.total}
          subtext="Monitored machines"
          color="#00A9AE"
          icon={Activity}
          delay={0.05}
          onClick={() => { setStatusFilter('All'); setIssueFilter(false); }}
          active={statusFilter === 'All' && !issueFilter}
        />
        <SummaryTile
          label="Healthy"
          value={summary.healthy}
          subtext={`${Math.round((summary.healthy / summary.total) * 100)}% operational`}
          color="#1FA971"
          icon={CheckCircle2}
          delay={0.1}
          onClick={() => { setStatusFilter('Healthy'); setIssueFilter(false); }}
          active={statusFilter === 'Healthy'}
        />
        <SummaryTile
          label="Warning"
          value={summary.warning}
          subtext="Minor threshold drift"
          color="#F59E0B"
          icon={AlertTriangle}
          delay={0.15}
          onClick={() => { setStatusFilter('Warning'); setIssueFilter(false); }}
          active={statusFilter === 'Warning'}
        />
        <SummaryTile
          label="Critical"
          value={summary.critical}
          subtext="Immediate action needed"
          color="#E24C4C"
          icon={AlertTriangle}
          delay={0.2}
          onClick={() => { setStatusFilter('Critical'); setIssueFilter(false); }}
          active={statusFilter === 'Critical'}
        />
        <SummaryTile
          label="Offline"
          value={summary.offline}
          subtext="Unreachable / Maintenance"
          color="#6B7690"
          icon={WifiOff}
          delay={0.25}
          onClick={() => { setStatusFilter('Offline'); setIssueFilter(false); }}
          active={statusFilter === 'Offline'}
        />
        <SummaryTile
          label="Active Issues"
          value={summary.issuesCount}
          subtext="Agent investigations"
          color="#9333EA"
          icon={Bot}
          delay={0.3}
          onClick={() => setIssueFilter(!issueFilter)}
          active={issueFilter}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-panel border border-border rounded-[12px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          {/* Search box */}
          <div className="relative flex-1 max-w-[340px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by machine name, code, or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-teal/50"
            />
          </div>

          {/* Plant filter */}
          <div className="relative">
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-border rounded-lg px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-teal/50 appearance-none pr-8 cursor-pointer font-medium"
            >
              <option value="All Plants">All Plants</option>
              {PLANTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#F8FAFC] border border-border rounded-lg px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-teal/50 appearance-none pr-8 cursor-pointer font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Healthy">Healthy</option>
              <option value="Warning">Warning</option>
              <option value="Critical">Critical</option>
              <option value="Offline">Offline</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="text-xs text-muted flex items-center gap-2">
          <span>Showing <strong>{filtered.length}</strong> of <strong>{machines.length}</strong> machines</span>
          {(search || statusFilter !== 'All' || plantFilter !== 'All Plants' || issueFilter) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('All'); setPlantFilter('All Plants'); setIssueFilter(false); }}
              className="text-teal font-semibold hover:underline ml-2"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table content */}
      {filtered.length === 0 ? (
        <div className="bg-panel border border-border rounded-[14px] p-12 text-center text-muted flex flex-col items-center justify-center gap-3">
          <Filter className="w-8 h-8 text-slate-400" />
          <div className="font-head text-lg font-bold text-ink">No machines found matching your criteria</div>
          <p className="text-xs max-w-sm">Try clearing filters or changing search keywords.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((machine, idx) => (
            <MachineCard key={machine.id} machine={machine} delay={idx * 0.04} />
          ))}
        </div>
      ) : (
        <MachineTable machines={filtered} />
      )}
    </motion.div>
  );
};
