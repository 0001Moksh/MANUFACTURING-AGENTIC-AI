import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Bot, AlertTriangle, CheckCircle2, WifiOff,
  Search, Filter, LayoutGrid, List, RefreshCw, ChevronDown, Cpu
} from 'lucide-react';
import { getMachineSummary, PLANTS } from '../data/machineMonitoringData';
import type { MachineStatus } from '../data/machineMonitoringData';
import { MachineCard } from '../components/machine-monitoring/MachineCard';
import { MachineTable } from '../components/machine-monitoring/MachineTable';
import { useMachineStore } from '../store/useMachineStore';

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
    whileHover={{ y: -3 }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.3, delay }}
    onClick={onClick}
    className={`relative overflow-hidden bg-white/90 backdrop-blur-xl border rounded-[16px] p-[18px] flex flex-col gap-[10px] transition-all cursor-pointer ${active
        ? 'ring-2 ring-teal border-transparent shadow-[0_10px_30px_-8px_rgba(31,169,113,0.4)]'
        : 'border-slate-200 shadow-sm hover:border-teal/40 hover:shadow-md'
      }`}
  >
    {active && (
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    )}
    <div className="flex items-center justify-between">
      <span className="text-[10.5px] font-bold tracking-[0.6px] text-muted uppercase">{label}</span>
      <div
        className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shadow-inner"
        style={{ background: `${color}18` }}
      >
        <Icon className="w-[14px] h-[14px]" style={{ color }} />
      </div>
    </div>
    <div className="font-head text-[30px] font-extrabold tracking-tight" style={{ color }}>{value}</div>
    {subtext && <div className="text-[11px] text-muted">{subtext}</div>}
  </motion.div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const MachineMonitoringPage: React.FC = () => {
  const machines = useMachineStore((state) => state.machines);
  const tickAllMachines = useMachineStore((state) => state.tickAllMachines);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'All'>('All');
  const [plantFilter, setPlantFilter] = useState('All Plants');
  const [issueFilter, setIssueFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Background real-time telemetry stream tick across all 13 machines
  useEffect(() => {
    const interval = setInterval(() => {
      tickAllMachines();
    }, 2500);
    return () => clearInterval(interval);
  }, [tickAllMachines]);

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
    tickAllMachines();
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const hasActiveFilters = search || statusFilter !== 'All' || plantFilter !== 'All Plants' || issueFilter;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 flex flex-col gap-6 bg-gradient-to-b from-[#F7F8FA] to-[#EEF1F5] min-h-screen"
    >
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal/20 to-teal/5 border border-teal/30 flex items-center justify-center shadow-sm">
              <Cpu className="w-5 h-5 text-teal" />
            </div>
            <h1 className="font-head text-[26px] font-extrabold text-ink tracking-tight">Continuous Machine Monitoring</h1>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-teal/15 to-teal/5 text-teal border border-teal/30 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-teal animate-ping" />
              LIVE TELEMETRY STREAM
            </span>
          </div>
          <p className="text-muted text-[13.5px] max-w-2xl">
            Real-time machine health telemetry, anomaly detection & automated agentic root-cause analysis across all plant operations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/90 backdrop-blur border border-slate-200 text-ink hover:border-teal/50 hover:shadow-md font-semibold text-xs shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>

          {/* View toggle */}
          <div className="flex items-center bg-white/90 backdrop-blur p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setView('grid')}
              className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-gradient-to-br from-teal to-teal-deep text-white shadow-md' : 'text-muted hover:text-ink'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-2 rounded-lg transition-all ${view === 'table' ? 'bg-gradient-to-br from-teal to-teal-deep text-white shadow-md' : 'text-muted hover:text-ink'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
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
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[16px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.1)]">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          {/* Search box */}
          <div className="relative flex-1 max-w-[340px] min-w-[220px]">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by machine name, code, or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-teal/60 focus:ring-2 focus:ring-teal/10 transition-all"
            />
          </div>

          {/* Plant filter */}
          <div className="relative">
            <select
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-teal/60 appearance-none pr-8 cursor-pointer font-medium transition-all"
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
              className="bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-teal/60 appearance-none pr-8 cursor-pointer font-medium transition-all"
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

        <div className="text-xs text-muted flex items-center gap-2 shrink-0">
          <span>Showing <strong className="text-ink">{filtered.length}</strong> of <strong className="text-ink">{machines.length}</strong> machines</span>
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => { setSearch(''); setStatusFilter('All'); setPlantFilter('All Plants'); setIssueFilter(false); }}
                className="text-teal font-bold hover:underline ml-1 px-2 py-1 rounded-md hover:bg-teal/10 transition-colors"
              >
                Clear Filters
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Grid or Table content */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-14 text-center text-muted flex flex-col items-center justify-center gap-3 shadow-sm"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Filter className="w-7 h-7 text-slate-400" />
            </div>
            <div className="font-head text-lg font-bold text-ink">No machines found matching your criteria</div>
            <p className="text-xs max-w-sm">Try clearing filters or changing search keywords.</p>
          </motion.div>
        ) : view === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filtered.map((machine, idx) => (
              <MachineCard key={machine.id} machine={machine} delay={idx * 0.04} />
            ))}
          </motion.div>
        ) : (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MachineTable machines={filtered} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};