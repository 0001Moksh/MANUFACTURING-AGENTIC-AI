import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Thermometer, Zap, Activity, AlertTriangle } from 'lucide-react';
import type { Machine, MachineStatus, LiveMetric } from '../../data/machineMonitoringData';

// ─── Status helpers (imported by MachineDetailPage) ───────────────────────────
export const STATUS_COLOR: Record<MachineStatus, string> = {
  Healthy: '#1FA971',
  Warning: '#F59E0B',
  Critical: '#E24C4C',
  Offline: '#6B7690',
};

export const STATUS_BG: Record<MachineStatus, string> = {
  Healthy: 'rgba(31,169,113,0.12)',
  Warning: 'rgba(245,158,11,0.12)',
  Critical: 'rgba(226,76,76,0.12)',
  Offline: 'rgba(107,118,144,0.10)',
};

export const HEALTH_COLOR = (score: number, status: MachineStatus) => {
  if (status === 'Offline') return '#6B7690';
  if (score >= 80) return '#1FA971';
  if (score >= 50) return '#F59E0B';
  return '#E24C4C';
};

// ─── Health Ring (still used by MachineDetailPage) ────────────────────────────
export const HealthRing: React.FC<{ score: number; status: MachineStatus; size?: number }> = ({
  score,
  status,
  size = 52,
}) => {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = status === 'Offline' ? 0 : score / 100;
  const color = HEALTH_COLOR(score, status);
  const gradId = `ring-grad-${size}-${status}-${score}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8ECF2" strokeWidth={4.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={800}
        fill={color}
        fontFamily="'Manrope', sans-serif"
      >
        {status === 'Offline' ? '—' : `${score}%`}
      </text>
    </svg>
  );
};

// ─── Metric picking ───────────────────────────────────────────────────────────
const tokensOf = (m: LiveMetric) =>
  new Set(
    `${m.key} ${m.label}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
  );

const isAvg = (t: Set<string>) => t.has('avg') || t.has('average');

const pickMetric = (
  metrics: LiveMetric[],
  base: string[],
  prefer: (t: Set<string>) => boolean
): LiveMetric | undefined => {
  const info = metrics.map((m) => ({ m, t: tokensOf(m) }));
  const candidates = info.filter(({ t }) => base.some((b) => t.has(b)));
  return (candidates.find(({ t }) => prefer(t)) ?? candidates[0])?.m;
};

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? 'N/A' : String(Math.round(v * 10) / 10);

// ─── Small stat tile ──────────────────────────────────────────────────────────
const StatTile: React.FC<{
  label: string;
  icon: React.ElementType;
  iconColor: string;
  valueColor: string;
  metric?: LiveMetric;
  caption: string;
}> = ({ label, icon: Icon, iconColor, valueColor, metric, caption }) => (
  <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2">
    <div className="flex items-center gap-1">
      <Icon className="h-3 w-3 shrink-0" style={{ color: iconColor }} />
      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
    </div>
    <div className="font-mono text-[15px] font-extrabold leading-none" style={{ color: valueColor }}>
      {fmt(metric?.value)}
      {metric && metric.value !== null && (
        <span className="ml-0.5 text-[10px] font-semibold text-slate-500">{metric.unit}</span>
      )}
    </div>
    <span className="text-[9px] text-slate-400">{caption}</span>
  </div>
);

// ─── Machine Card ─────────────────────────────────────────────────────────────
interface MachineCardProps {
  machine: Machine;
  delay?: number;
  isTable?: boolean;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, delay = 0 }) => {
  const navigate = useNavigate();
  const sanitizedMachineName = machine.name.replace(/^InfluxDB\s+Machine\s*/i, '').trim() || machine.code;
  const statusColor = STATUS_COLOR[machine.status];

  // Optional fields — adjust to your Machine type if they are named differently
  const extra = machine as Machine & { gateway?: string; operationalState?: string };
  const gateway = extra.gateway;
  const badgeText = (extra.operationalState || machine.status).toString().toUpperCase();

  const voltage = pickMetric(machine.liveMetrics, ['voltage'], isAvg);
  const current = pickMetric(machine.liveMetrics, ['current'], isAvg);
  const temp = pickMetric(
    machine.liveMetrics,
    ['temperature', 'temp'],
    (t) => t.has('motor')
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, boxShadow: `0 16px 32px -12px ${statusColor}40` }}
      onClick={() => navigate(`/machine-monitoring/${machine.id}`)}
      className="relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pl-5 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.12)] transition-colors hover:border-slate-300"
    >
      {/* Left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: statusColor }} />

      {/* Header: code + type / status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[17px] font-extrabold tracking-tight text-ink">{machine.code}</span>
          {machine.type && (
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-teal">
              {machine.type}
            </span>
          )}
        </div>
        <span
          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-extrabold tracking-wide"
          style={{ background: STATUS_BG[machine.status], color: statusColor, border: `1px solid ${statusColor}40` }}
        >
          {badgeText}
        </span>
      </div>

      {/* Name + gateway */}
      <div className="min-w-0">
        <h3 className="truncate font-head text-[14px] font-bold leading-tight text-ink">{sanitizedMachineName}</h3>
        {gateway && <p className="mt-0.5 truncate text-[10px] text-slate-400">Gateway: {gateway}</p>}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          label="Voltage"
          icon={Zap}
          iconColor="#E7A93A"
          valueColor="#D9822B"
          metric={voltage}
          caption="Average"
        />
        <StatTile
          label="Current"
          icon={Activity}
          iconColor="#4C86F0"
          valueColor="#2A5DBB"
          metric={current}
          caption="Average"
        />
        <StatTile
          label="Temp"
          icon={Thermometer}
          iconColor="#F4785A"
          valueColor="#0F7A54"
          metric={temp}
          caption="Motor"
        />
      </div>

      {/* Active issues chip (only when there are any) */}
      {machine.activeIssues > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{machine.lastIssueText || 'Active alert'}</span>
          <span className="ml-auto shrink-0 font-mono font-bold">{machine.activeIssues} active</span>
        </div>
      )}
    </motion.div>
  );
};