import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Thermometer, Zap, Activity, Gauge, RotateCw,
  AlertTriangle, WifiOff, Bot, ChevronRight, Clock
} from 'lucide-react';
import type { Machine, MachineStatus, LiveMetric } from '../../data/machineMonitoringData';

// ─── Status helpers ───────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<MachineStatus, string> = {
  Healthy: '#1FA971',
  Warning: '#F59E0B',
  Critical: '#E24C4C',
  Offline: '#6B7690',
};

export const STATUS_BG: Record<MachineStatus, string> = {
  Healthy: 'rgba(31,169,113,0.10)',
  Warning: 'rgba(245,158,11,0.10)',
  Critical: 'rgba(226,76,76,0.10)',
  Offline: 'rgba(107,118,144,0.10)',
};

export const HEALTH_COLOR = (score: number, status: MachineStatus) => {
  if (status === 'Offline') return '#6B7690';
  if (score >= 80) return '#1FA971';
  if (score >= 50) return '#F59E0B';
  return '#E24C4C';
};

const METRIC_ICONS: Record<string, React.FC<{ className?: string }>> = {
  temperature: Thermometer,
  vibration: Activity,
  current: Zap,
  power: Gauge,
  rpm: RotateCw,
};

const METRIC_STATUS_COLOR: Record<string, string> = {
  normal: '#1FA971',
  warning: '#F59E0B',
  critical: '#E24C4C',
};

const AGENT_STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  'Idle': { bg: 'rgba(31,169,113,0.10)', text: '#1FA971', dot: '#1FA971' },
  'Investigating': { bg: 'rgba(245,158,11,0.10)', text: '#F59E0B', dot: '#F59E0B' },
  'Issue Generated': { bg: 'rgba(226,76,76,0.10)', text: '#E24C4C', dot: '#E24C4C' },
  'Monitoring': { bg: 'rgba(0,169,174,0.10)', text: '#00A9AE', dot: '#00A9AE' },
};

// ─── Sparkline SVG Component ──────────────────────────────────────────────────

export const Sparkline: React.FC<{ data: number[]; color: string; height?: number }> = ({ data, color, height = 24 }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const width = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      {data.length > 0 && (() => {
        const lastVal = data[data.length - 1];
        const cx = width;
        const cy = height - ((lastVal - min) / range) * (height - 4) - 2;
        return <circle cx={cx} cy={cy} r="2.5" fill={color} />;
      })()}
    </svg>
  );
};

// ─── Health Ring ──────────────────────────────────────────────────────────────

export const HealthRing: React.FC<{ score: number; status: MachineStatus; size?: number }> = ({ score, status, size = 52 }) => {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const pct = status === 'Offline' ? 0 : score / 100;
  const color = HEALTH_COLOR(score, status);
  const gradId = `ring-grad-${size}-${status}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EBEEF4" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={`url(#${gradId})`} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill={color} fontFamily="'Manrope',sans-serif">
        {status === 'Offline' ? '—' : `${score}%`}
      </text>
    </svg>
  );
};

// ─── Machine Card ─────────────────────────────────────────────────────────────

interface MachineCardProps {
  machine: Machine;
  delay?: number;
  isTable?: boolean;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, delay = 0 }) => {
  const navigate = useNavigate();
  const statusColor = STATUS_COLOR[machine.status];
  const agentStyle = AGENT_STATUS_COLOR[machine.agentStatus] || AGENT_STATUS_COLOR['Idle'];
  const [, setTick] = useState(0);

  // Live signal simulation jitter
  useEffect(() => {
    if (machine.status === 'Offline') return;
    const interval = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, [machine.status]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5, boxShadow: '0 20px 40px -12px rgba(11,15,25,0.18)' }}
      onClick={() => navigate(`/machine-monitoring/${machine.id}`)}
      className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[18px] p-[18px] flex flex-col justify-between cursor-pointer transition-all relative overflow-hidden group hover:border-teal/50 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.1)]"
    >
      {/* Status indicator banner strip — gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${statusColor}, ${statusColor}55, transparent)` }}
      />
      {/* Subtle corner glow on hover */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: `${statusColor}25` }}
      />

      {/* Top Header */}
      <div className="relative">
        <div className="flex items-start justify-between gap-[10px] mb-[14px]">
          <div className="flex items-center gap-[10px]">
            <HealthRing score={machine.healthScore} status={machine.status} size={50} />
            <div>
              <div className="flex items-center gap-[6px]">
                <h3 className="font-head text-[15px] font-bold text-ink group-hover:text-teal transition-colors">
                  {machine.name}
                </h3>
                <span className="font-mono text-[10.5px] px-[6px] py-[1px] bg-slate-100 text-muted rounded-[5px] border border-slate-200/60">
                  {machine.code}
                </span>
              </div>
              <p className="text-[11.5px] text-muted font-medium mt-[2px]">
                {machine.plant} • {machine.line}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-[5px]">
            <span
              className="text-[11px] font-bold px-[9px] py-[3px] rounded-[20px] flex items-center gap-[5px] shadow-sm"
              style={{ background: STATUS_BG[machine.status], color: statusColor }}
            >
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: statusColor }} />
              {machine.status}
            </span>
            <span className="text-[10.5px] text-muted flex items-center gap-[3px]">
              <Clock className="w-[10px] h-[10px]" />
              {machine.lastUpdated}
            </span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-3 gap-[7px] my-[14px]">
          {machine.liveMetrics.slice(0, 3).map((m: LiveMetric) => {
            const IconComp = METRIC_ICONS[m.key] || Activity;
            const mColor = METRIC_STATUS_COLOR[m.status] || '#1FA971';
            return (
              <div
                key={m.key}
                className="bg-gradient-to-br from-slate-50 to-white border border-slate-200/70 rounded-[10px] p-[9px] flex flex-col justify-between shadow-sm"
              >
                <div className="flex items-center justify-between text-muted mb-[3px]">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3px] truncate">{m.label}</span>
                  <IconComp className="w-[11px] h-[11px] shrink-0 opacity-70" />
                </div>
                <div className="font-mono text-[12.5px] font-bold flex items-baseline gap-[2px]" style={{ color: mColor }}>
                  {m.value}
                  <span className="text-[9.5px] text-muted font-normal">{m.unit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Issues Banner */}
        {machine.activeIssues > 0 ? (
          <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200 rounded-[10px] p-[9px_11px] flex items-center justify-between mb-[14px]">
            <div className="flex items-center gap-[6px]">
              <AlertTriangle className="w-[13px] h-[13px] text-amber-600 shrink-0" />
              <span className="text-[11.5px] font-medium text-amber-900 truncate max-w-[200px]">
                {machine.lastIssueText || `${machine.activeIssues} active alert(s)`}
              </span>
            </div>
            <span className="text-[10.5px] font-bold font-mono text-amber-700 bg-amber-200/60 px-[6px] py-[2px] rounded-[5px] shrink-0">
              {machine.activeIssues} Active
            </span>
          </div>
        ) : machine.status === 'Offline' ? (
          <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-[10px] p-[9px_11px] flex items-center gap-[6px] mb-[14px] text-slate-500 text-[11.5px]">
            <WifiOff className="w-[13px] h-[13px]" />
            <span>Machine is currently powered off / non-communicating</span>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/30 border border-emerald-200 rounded-[10px] p-[9px_11px] flex items-center gap-[6px] mb-[14px] text-emerald-800 text-[11.5px]">
            <div className="w-[6px] h-[6px] rounded-full bg-emerald-500 animate-pulse" />
            <span>Telemetry baseline nominal • 0 anomalies detected</span>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="relative pt-[11px] border-t border-slate-100 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-[7px]">
          <span
            className="w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 shadow-inner"
            style={{ background: agentStyle.bg }}
          >
            <Bot className="w-[12px] h-[12px]" style={{ color: agentStyle.text }} />
          </span>
          <span className="text-[11px] font-medium text-muted truncate max-w-[150px]">
            {machine.agentStatus}
          </span>
        </div>

        <div className="flex items-center gap-[4px] text-[12px] font-bold text-teal group-hover:translate-x-1 transition-transform">
          <span>Details & Telemetry</span>
          <ChevronRight className="w-[14px] h-[14px]" />
        </div>
      </div>
    </motion.div>
  );
};