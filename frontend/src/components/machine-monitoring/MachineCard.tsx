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

const METRIC_ICONS: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
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

const AGENT_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  Idle: { bg: 'rgba(31,169,113,0.12)', text: '#1FA971' },
  Investigating: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
  'Issue Generated': { bg: 'rgba(226,76,76,0.12)', text: '#E24C4C' },
  Monitoring: { bg: 'rgba(0,169,174,0.12)', text: '#00A9AE' },
};

// ─── Gauge zone defaults ──────────────────────────────────────────────────────
// Used whenever a LiveMetric doesn't carry its own min/max/warningAt/criticalAt.
// Numbers mirror typical shop-floor thresholds (temp °C, vibration mm/s, current A).
interface GaugeZones {
  min: number;
  max: number;
  warningAt: number;
  criticalAt: number;
}

const DEFAULT_ZONES: Record<string, GaugeZones> = {
  temperature: { min: 0, max: 120, warningAt: 75, criticalAt: 88 },
  vibration: { min: 0, max: 10, warningAt: 3.5, criticalAt: 5.0 },
  current: { min: 0, max: 220, warningAt: 160, criticalAt: 180 },
  power: { min: 0, max: 100, warningAt: 80, criticalAt: 92 },
  rpm: { min: 0, max: 4000, warningAt: 3200, criticalAt: 3600 },
};

const getZones = (m: LiveMetric): GaugeZones => {
  const anyM = m as unknown as Partial<GaugeZones>;
  const base = DEFAULT_ZONES[m.key] || { min: 0, max: 100, warningAt: 70, criticalAt: 90 };
  return {
    min: anyM.min ?? base.min,
    max: anyM.max ?? base.max,
    warningAt: anyM.warningAt ?? base.warningAt,
    criticalAt: anyM.criticalAt ?? base.criticalAt,
  };
};

// ─── Polar helpers for the gauge arcs ─────────────────────────────────────────
const GAUGE_START = -125; // degrees, 0 = 12 o'clock, clockwise-positive
const GAUGE_END = 125;
const GAUGE_SWEEP = GAUGE_END - GAUGE_START;

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const arcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  if (endAngle <= startAngle) return '';
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

const valueToAngle = (value: number, min: number, max: number) => {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return GAUGE_START + pct * GAUGE_SWEEP;
};

// ─── Gauge Dial ────────────────────────────────────────────────────────────────
interface GaugeDialProps {
  metric: LiveMetric;
  size?: number;
}

export const GaugeDial: React.FC<GaugeDialProps> = ({ metric, size = 128 }) => {
  const zones = getZones(metric);
  const numericValue = typeof metric.value === 'number' ? metric.value : 0;
  const color = METRIC_STATUS_COLOR[metric.status] || '#1FA971';
  const Icon = METRIC_ICONS[metric.key] || Activity;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const trackWidth = 8;

  const warnAngle = valueToAngle(zones.warningAt, zones.min, zones.max);
  const critAngle = valueToAngle(zones.criticalAt, zones.min, zones.max);
  const needleAngle = valueToAngle(numericValue, zones.min, zones.max);
  const needleTip = polarToCartesian(cx, cy, r - trackWidth / 2 - 2, needleAngle);
  const needleBase1 = polarToCartesian(cx, cy, 6, needleAngle + 90);
  const needleBase2 = polarToCartesian(cx, cy, 6, needleAngle - 90);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {/* Background track */}
        <path
          d={arcPath(cx, cy, r, GAUGE_START, GAUGE_END)}
          fill="none"
          stroke="#E8ECF2"
          strokeWidth={trackWidth}
          strokeLinecap="round"
        />
        {/* Colored zones */}
        <path
          d={arcPath(cx, cy, r, GAUGE_START, warnAngle)}
          fill="none"
          stroke="#1FA971"
          strokeWidth={trackWidth}
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, r, warnAngle, critAngle)}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={trackWidth}
        />
        <path
          d={arcPath(cx, cy, r, critAngle, GAUGE_END)}
          fill="none"
          stroke="#E24C4C"
          strokeWidth={trackWidth}
          strokeLinecap="round"
        />
        {/* Needle */}
        <polygon
          points={`${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y} ${needleTip.x},${needleTip.y}`}
          fill={color}
          style={{ transition: 'all 0.6s ease' }}
        />
        <circle cx={cx} cy={cy} r={7} fill="#fff" stroke={color} strokeWidth={2.5} />

        {/* Icon */}
        <foreignObject x={cx - 9} y={cy - r * 0.42} width={18} height={18}>
          <Icon className="w-[18px] h-[18px]" style={{ color: '#94A3B8' } as React.CSSProperties} />
        </foreignObject>

        {/* Value readout */}
        <text
          x={cx}
          y={cy + r * 0.52}
          textAnchor="middle"
          fontSize={15}
          fontWeight={800}
          fill={color}
          fontFamily="'Manrope', sans-serif"
        >
          {metric.value === null ? 'N/A' : metric.value}
          <tspan fontSize={9} fontWeight={600} fill="#94A3B8"> {metric.unit}</tspan>
        </text>
      </svg>

      <span className="text-[11px] font-bold text-ink -mt-1">{metric.label}</span>
      <div className="flex items-center gap-2 mt-0.5 text-[9.5px] font-medium text-slate-400">
        <span>Normal: {zones.min}-{zones.warningAt}</span>
        <span className="text-slate-300">·</span>
        <span>Warn: {zones.warningAt}+</span>
      </div>
    </div>
  );
};

// ─── Health Ring ──────────────────────────────────────────────────────────────
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

// ─── Machine Card (Light Theme) ───────────────────────────────────────────────
interface MachineCardProps {
  machine: Machine;
  delay?: number;
  isTable?: boolean;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, delay = 0 }) => {
  const navigate = useNavigate();
  const statusColor = STATUS_COLOR[machine.status];
  const agentStyle = AGENT_STATUS_COLOR[machine.agentStatus] || AGENT_STATUS_COLOR.Idle;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (machine.status === 'Offline') return;
    const interval = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(interval);
  }, [machine.status]);

  const gaugeMetrics = machine.liveMetrics.slice(0, 2);
  const chipMetrics = machine.liveMetrics.slice(2, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5, boxShadow: `0 20px 40px -12px ${statusColor}40` }}
      onClick={() => navigate(`/machine-monitoring/${machine.id}`)}
      className="relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-[20px] p-[18px] group bg-white border border-slate-200/90 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.1)] hover:border-slate-300 transition-colors"
    >
      {/* Top status accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${statusColor}, ${statusColor}55, transparent)`,
        }}
      />

      {/* Soft corner glow on hover */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        style={{ background: `${statusColor}22` }}
      />

      {/* ── Header ── */}
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <HealthRing score={machine.healthScore} status={machine.status} size={52} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-head text-[15px] font-bold text-ink leading-tight truncate group-hover:text-teal transition-colors">
                  {machine.name}
                </h3>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200/80 shrink-0">
                  {machine.code}
                </span>
              </div>
              <p className="text-[11.5px] text-muted font-medium mt-0.5 truncate">
                {/* {machine.plant} · {machine.line} */}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm"
              style={{
                background: STATUS_BG[machine.status],
                color: statusColor,
                border: `1px solid ${statusColor}33`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: statusColor }}
              />
              {machine.status}
            </span>

            <span className="text-[10.5px] text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(machine.lastUpdated).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                // second: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        </div>

        {/* ── Gauge Dials (primary 2 metrics, e.g. vibration + temperature) ── */}
        <div className="grid grid-cols-2 gap-2 mb-3 rounded-xl bg-slate-50/70 border border-slate-200/70 py-3">
          {gaugeMetrics.map((m: LiveMetric) => (
            <GaugeDial key={m.key} metric={m} size={116} />
          ))}
        </div>

        {/* ── Secondary metric chips ── */}
        {chipMetrics.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {chipMetrics.map((m: LiveMetric) => {
              const IconComp = METRIC_ICONS[m.key] || Activity;
              const mColor = METRIC_STATUS_COLOR[m.status] || '#1FA971';
              return (
                <div
                  key={m.key}
                  className="rounded-xl px-2.5 py-2 flex flex-col gap-1 bg-slate-50/80 border border-slate-200/70"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 truncate">
                      {m.label.slice(0, 7)}
                    </span>
                    <IconComp className="w-3 h-3 shrink-0 opacity-70" style={{ color: mColor }} />
                  </div>
                  <div className="font-mono text-[13px] font-bold leading-none" style={{ color: mColor }}>
                    {m.value}
                    <span className="text-[9px] font-medium text-slate-400 ml-0.5">{m.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Issue / Status Banner ── */}
        {machine.activeIssues > 0 ? (
          <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 mb-1 bg-gradient-to-r from-rose-50 to-rose-50/40 border border-rose-200/80">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-[11.5px] font-medium text-rose-800/90 truncate">
                {machine.lastIssueText || `${machine.activeIssues} active alert(s)`}
              </span>
            </div>
            <span className="text-[10.5px] font-bold font-mono text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md shrink-0 border border-rose-200">
              {machine.activeIssues} Active
            </span>
          </div>
        ) : machine.status === 'Offline' ? (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-1 bg-slate-50 border border-slate-200 text-slate-500 text-[11.5px]">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Machine offline / non-communicating</span>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-1 bg-gradient-to-r from-emerald-50 to-emerald-50/30 border border-emerald-200/80 text-emerald-800 text-[11.5px]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>Telemetry baseline nominal · 0 anomalies</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="relative mt-4 pt-3.5 flex items-center justify-between border-t border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ background: agentStyle.bg }}
          >
            <Bot className="w-3 h-3" style={{ color: agentStyle.text }} />
          </span>
          <span className="text-[11px] font-medium text-muted truncate">{machine.agentStatus}</span>
        </div>

        <div className="flex items-center gap-1 text-[12px] font-bold text-teal group-hover:translate-x-1 transition-transform">
          <span>Details & Telemetry</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </motion.div>
  );
};