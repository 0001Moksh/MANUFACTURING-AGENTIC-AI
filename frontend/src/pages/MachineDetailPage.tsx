import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bot, MapPin, Wrench, Shield, FileText, Sparkles, Activity,
  Thermometer, Zap, Plug, Gauge as RpmIcon, X
} from 'lucide-react';
import { MOCK_MACHINES, STATUS_DESCRIPTIONS } from '../data/machineMonitoringData';
import { TelemetryChart } from '../components/machine-monitoring/TelemetryChart';
import { HealthRing, STATUS_COLOR, STATUS_BG } from '../components/machine-monitoring/MachineCard';

/* ------------------------------------------------------------------ */
/*  Per-metric visual theme (matches the colored KPI cards in mockup)  */
/* ------------------------------------------------------------------ */
const METRIC_THEME: Record<
  string,
  { icon: React.ElementType; from: string; to: string; ring: string; text: string }
> = {
  temperature: { icon: Thermometer, from: '#FFD6CE', to: '#FFF1EE', ring: '#F4785A', text: '#B5432A' },
  vibration:   { icon: Activity,    from: '#F0D9FF', to: '#FAF1FF', ring: '#B76BF2', text: '#7C3AAB' },
  current:     { icon: Zap,         from: '#CFE3FF', to: '#EFF5FF', ring: '#4C86F0', text: '#2A5DBB' },
  power:       { icon: Plug,        from: '#FFE9BE', to: '#FFF7E8', ring: '#E7A93A', text: '#9C6A11' },
  rpm:         { icon: RpmIcon,     from: '#C9F2E4', to: '#EFFCF8', ring: '#1FA971', text: '#0F7A54' },
};

const DEFAULT_THEME = METRIC_THEME.rpm;

/* ------------------------------------------------------------------ */
/*  Semicircle gauge dial — gold/black theme, used in Thresholds panel */
/* ------------------------------------------------------------------ */
const GaugeDial: React.FC<{
  min: number;
  max: number;
  value: number;
  normalRange: [number, number];
  warningThreshold?: number;
  criticalThreshold?: number;
}> = ({ min, max, value, normalRange, warningThreshold, criticalThreshold }) => {
  const W = 160;
  const H = 92;
  const cx = W / 2;
  const cy = H - 6;
  const r = 62;

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const span = max - min;
  const angleFor = (v: number) => 180 - ((clamp(v) - min) / (span || 1)) * 180; // 180deg (left) -> 0deg (right)
  const point = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy - radius * Math.sin(rad)];
  };
  const arcPath = (a1: number, a2: number, radius: number) => {
    const [x1, y1] = point(a1, radius);
    const [x2, y2] = point(a2, radius);
    const largeArc = Math.abs(a1 - a2) > 180 ? 1 : 0;
    // a1 -> a2 always decreases (180 -> 0), which sweeps clockwise on screen (y is flipped)
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };
  // Avoid float garbage like 8.100000000000001 and keep labels short
  const fmt = (n: number) => {
    const rounded = Math.round(n * 100) / 100;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  };

  const warn = warningThreshold ?? normalRange[1];
  const crit = criticalThreshold ?? warn;

  const aStart = angleFor(min);
  const aNormalEnd = angleFor(normalRange[1]);
  const aWarnEnd = angleFor(warn);
  const aEnd = angleFor(max);

  const needleAngle = angleFor(value);
  const needleTip = point(needleAngle, r - 14);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* track base */}
      <path d={arcPath(180, 0, r)} fill="none" stroke="#e7dcc0" strokeWidth="12" strokeLinecap="round" />
      {/* green (normal) */}
      {span > 0 && (
        <>
          <path d={arcPath(aStart, aNormalEnd, r)} fill="none" stroke="#1FA971" strokeWidth="12" strokeLinecap="round" />
          {/* amber (warning) */}
          {aWarnEnd !== aNormalEnd && (
            <path d={arcPath(aNormalEnd, aWarnEnd, r)} fill="none" stroke="#D9A441" strokeWidth="12" strokeLinecap="round" />
          )}
          {/* red (critical) */}
          {aEnd !== aWarnEnd && (
            <path d={arcPath(aWarnEnd, aEnd, r)} fill="none" stroke="#B4342A" strokeWidth="12" strokeLinecap="round" />
          )}
        </>
      )}
      {/* needle */}
      <line x1={cx} y1={cy} x2={needleTip[0]} y2={needleTip[1]} stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#B8860B" stroke="#1a1a1a" strokeWidth="1" />
      {/* min/max labels — anchored outward so they never collide with the arc ends */}
      <text x={point(180, r + 6)[0]} y={point(180, r + 6)[1] + 4} fontSize="9" fill="#8a7752" textAnchor="start">
        {fmt(min)}
      </text>
      <text x={point(0, r + 6)[0]} y={point(0, r + 6)[1] + 4} fontSize="9" fill="#8a7752" textAnchor="end">
        {fmt(max)}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Dynamic "heat" color: cool blue (low) → green (normal) → yellow    */
/*  (warning) → red (critical) → deep red (way past critical)          */
/* ------------------------------------------------------------------ */
type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpColor = (c1: RGB, c2: RGB, t: number): RGB => [
  lerp(c1[0], c2[0], t),
  lerp(c1[1], c2[1], t),
  lerp(c1[2], c2[2], t),
];
const rgbToCss = (c: RGB, alpha = 1) => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

const COOL: RGB = [59, 130, 246]; // blue-500  (well below normal)
const GOOD: RGB = [34, 197, 94]; // green-500 (normal)
const WARN: RGB = [234, 179, 8]; // amber-500 (warning)
const CRIT: RGB = [220, 38, 38]; // red-600   (critical)
const DEEP: RGB = [127, 29, 29]; // red-900   (way past critical)

function getHeatColor(value: number, m: typeof MOCK_MACHINES[0]['liveMetrics'][0]) {
  const [normLo, normHi] = m.normalRange;
  const warn = m.warningThreshold ?? normHi * 1.15;
  const crit = m.criticalThreshold ?? warn * 1.1;
  const deepEnd = crit + (crit - warn || crit * 0.15);

  let rgb: RGB;
  if (value < normLo) {
    // below normal → cool blue, colder the further below
    const span = normLo - (normLo - (warn - normHi || normLo * 0.3));
    const t = Math.min(1, Math.max(0, (normLo - value) / (span || 1)));
    rgb = lerpColor(GOOD, COOL, t);
  } else if (value <= normHi) {
    rgb = GOOD;
  } else if (value <= warn) {
    const t = (value - normHi) / ((warn - normHi) || 1);
    rgb = lerpColor(GOOD, WARN, t);
  } else if (value <= crit) {
    const t = (value - warn) / ((crit - warn) || 1);
    rgb = lerpColor(WARN, CRIT, t);
  } else {
    const t = Math.min(1, (value - crit) / ((deepEnd - crit) || 1));
    rgb = lerpColor(CRIT, DEEP, t);
  }
  return rgb;
}

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const machine = useMemo(() => {
    return MOCK_MACHINES.find((m) => m.id === id) || MOCK_MACHINES[0];
  }, [id]);

  const [activeTab, setActiveTab] = useState<'telemetry' | 'agent' | 'mes' | 'maintenance'>('telemetry');
  const [selectedMetric, setSelectedMetric] = useState<string>('vibration');

  // ── Live values for KPI cards (simulate real-time stream) ──
  // NOTE: this is now the single source of truth for "current value" —
  // both the gauge cards AND the TelemetryChart badge/latest-point read from here,
  // so they never disagree with each other.
  const [liveValues, setLiveValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(machine.liveMetrics.map((m) => [m.key, m.value]))
  );

  useEffect(() => {
    // Reset when machine changes
    setLiveValues(Object.fromEntries(machine.liveMetrics.map((m) => [m.key, m.value])));
  }, [machine.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveValues((prev) => {
        const next = { ...prev };
        machine.liveMetrics.forEach((m) => {
          const span = m.normalRange[1] - m.normalRange[0];
          // small realistic noise (~ ±4% of normal span)
          const noise = (Math.random() - 0.5) * span * 0.08;
          const raw = m.value + noise;
          // keep one decimal for most metrics
          next[m.key] = Math.round(raw * 10) / 10;
        });
        return next;
      });
    }, 900); // ~ same cadence as a typical telemetry stream
    return () => clearInterval(interval);
  }, [machine]);

  // Helper: derive status from a live value
  const getLiveStatus = (m: typeof machine.liveMetrics[0], liveVal: number) => {
    if (m.criticalThreshold != null && liveVal >= m.criticalThreshold) return 'critical';
    if (m.warningThreshold != null && liveVal >= m.warningThreshold) return 'warning';
    if (liveVal < m.normalRange[0]) {
      if (m.criticalThreshold != null && liveVal <= m.normalRange[0] - (m.criticalThreshold - m.normalRange[1])) {
        return 'critical';
      }
      return 'warning';
    }
    return 'normal';
  };

  const statusColor = STATUS_COLOR[machine.status];
  const currentMetricObj = machine.liveMetrics.find((m) => m.key === selectedMetric) || machine.liveMetrics[0];
  const currentLiveValue = liveValues[currentMetricObj.key] ?? currentMetricObj.value;

  const TABS = [
    { key: 'telemetry', label: 'Live Telemetry & Signals', icon: Activity },
    { key: 'agent', label: 'AI Agent Root-Cause Analysis', icon: Bot, alert: machine.activeIssues > 0 },
    { key: 'mes', label: 'MES Work Orders & Operator', icon: FileText },
    { key: 'maintenance', label: 'Maintenance & Service History', icon: Wrench },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 flex flex-col gap-6 bg-gradient-to-b from-[#F7F8FA] to-[#EEF1F5] min-h-screen"
    >
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted">
          <button
            onClick={() => navigate('/machine-monitoring')}
            className="group hover:text-teal flex items-center gap-1 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Machine Monitoring</span>
          </button>
          <span className="opacity-40">/</span>
          <span className="text-ink font-semibold">{machine.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/80 backdrop-blur border border-slate-200 text-slate-700 font-semibold shadow-sm">
            {machine.code}
          </span>
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm"
            style={{ background: STATUS_BG[machine.status], color: statusColor, boxShadow: `0 2px 12px -2px ${statusColor}40` }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusColor }} />
            {machine.status}
          </span>
        </div>
      </div>

      {/* Hero Machine Details Card */}
      <div className="relative bg-white/90 backdrop-blur-xl border border-white/60 rounded-[20px] p-7 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.15)] flex flex-col lg:flex-row lg:items-center justify-between gap-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-amber-200/30 via-teal/10 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal via-amber-300 to-teal" />

        <div className="relative flex items-start gap-5">
          <div className="relative">
            <HealthRing score={machine.healthScore} status={machine.status} size={76} />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center border border-slate-100">
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-head text-[26px] font-extrabold text-ink tracking-tight">{machine.name}</h1>
              <span className="text-[11px] px-2.5 py-1 rounded-md bg-gradient-to-r from-teal/15 to-teal/5 text-teal border border-teal/25 font-mono font-bold tracking-wide">
                {machine.type}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted mt-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal" />
                {machine.plant} • {machine.line}
              </span>
              <span className="opacity-30">•</span>
              <span>
                Operator: <strong className="text-ink font-semibold">{machine.operator}</strong>
              </span>
              <span className="opacity-30">•</span>
              <span>
                Installed: <strong className="text-ink font-semibold">{machine.installDate}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2.5 max-w-2xl leading-relaxed">
              {STATUS_DESCRIPTIONS[machine.status]}
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="relative flex items-center gap-5 lg:border-l lg:border-slate-200 lg:pl-7 shrink-0 pt-5 lg:pt-0 border-t lg:border-t-0">
          <KPI label="Active Issues" value={machine.activeIssues} accent={machine.activeIssues > 0 ? '#E24C4C' : '#059669'} />
          <Divider />
          <KPI label="OEE Impact" value="91.4%" accent="#0F172A" />
          <Divider />
          <div className="text-center">
            <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Agent Status</div>
            <div className="font-mono text-xs font-bold text-teal mt-1.5 flex items-center gap-1.5 justify-center bg-teal/10 px-2.5 py-1 rounded-full border border-teal/20">
              <Bot className="w-3.5 h-3.5" />
              {machine.agentStatus}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 flex-wrap relative">
        <div className="flex items-center gap-1 bg-white/70 backdrop-blur border border-slate-200 rounded-2xl p-1.5 text-sm font-semibold w-fit shadow-sm">
          {TABS.map(({ key, label, icon: Icon, alert }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                  isActive ? 'text-navy-950' : 'text-muted hover:text-ink'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-gradient-to-r from-teal to-teal-deep rounded-xl shadow-[0_4px_16px_-4px_rgba(31,169,113,0.5)]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className={`relative flex items-center gap-1.5 ${isActive ? 'text-white' : ''}`}>
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {alert && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping ml-1" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'telemetry' && (
            <div className="flex flex-col gap-6">
              {/* Signal Cards Selector – gold/black gauge dial style */}
              <div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {machine.liveMetrics.map((m) => {
                    const liveVal = liveValues[m.key] ?? m.value;
                    const liveStatus = getLiveStatus(m, liveVal);
                    const isSelected = selectedMetric === m.key;
                    const theme = METRIC_THEME[m.key] ?? DEFAULT_THEME;
                    const Icon = theme.icon;

                    const hasCritical = m.criticalThreshold != null;
                    const hasWarning = m.warningThreshold != null;
                    const axisMax = hasCritical
                      ? (m.criticalThreshold as number) * 1.08
                      : hasWarning
                      ? (m.warningThreshold as number) * 1.15
                      : m.normalRange[1] * 1.2;
                    const axisMin = Math.min(m.normalRange[0], 0);

                    const statusColorDot =
                      liveStatus === 'critical' ? '#B4342A' : liveStatus === 'warning' ? '#D9A441' : '#1FA971';

                    return (
                      <motion.div
                        key={m.key}
                        onClick={() => setSelectedMetric(m.key)}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative rounded-2xl p-4 border-2 flex flex-col items-center text-center cursor-pointer transition-shadow"
                        style={{
                          borderColor: isSelected ? '#000000' : '#000000',
                          background: 'linear-gradient(160deg, #ffffff 0%, #ffffff 100%)',
                          boxShadow: isSelected
                            ? '0 0 0 3px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(184,134,11,0.25)'
                            : 'inset 0 0 0 1px rgba(184,134,11,0.25)',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1 font-head font-extrabold text-[15px]" style={{ color: '#5a4a1e' }}>
                          <Icon className="w-4 h-4" style={{ color: '#000000' }} />
                          {m.label}
                          <span className="text-[10px] font-semibold opacity-70">({m.unit})</span>
                        </div>

                        <GaugeDial
                          min={axisMin}
                          max={axisMax}
                          value={liveVal}
                          normalRange={m.normalRange}
                          warningThreshold={m.warningThreshold}
                          criticalThreshold={m.criticalThreshold}
                        />

                        <div className="font-mono font-extrabold text-lg mt-1" style={{ color: '#4a3a12' }}>
                          {liveVal} <span className="text-[10px] font-semibold opacity-70">{m.unit}</span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold capitalize" style={{ color: statusColorDot }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColorDot }} />
                          {liveStatus}
                        </div>

                        <div className="text-[10px] mt-1 opacity-70" style={{ color: '#5a4a1e' }}>
                          Normal: {m.normalRange[0]}{'\u2013'}{m.normalRange[1]}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed TimeSeries Chart */}
              <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] overflow-hidden">
                <TelemetryChart
                  machineId={machine.id}
                  metricKey={currentMetricObj.key as any}
                  metricLabel={currentMetricObj.label}
                  unit={currentMetricObj.unit}
                  normalRange={currentMetricObj.normalRange}
                  warningThreshold={currentMetricObj.warningThreshold}
                  criticalThreshold={currentMetricObj.criticalThreshold}
                  liveValue={currentLiveValue}
                />
              </div>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-7 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal/20 to-teal/5 border border-teal/40 flex items-center justify-center text-teal shadow-inner">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-head font-bold text-lg text-ink">Autonomous Agent Investigation Trace</h3>
                    <p className="text-xs text-muted">
                      Continuous LLM signal monitoring, anomaly classification & proactive resolution recommendation.
                    </p>
                  </div>
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal/15 to-teal/5 text-teal border border-teal/30 text-xs font-mono font-bold shadow-sm">
                  Status: {machine.agentStatus}
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 text-white font-mono text-xs border border-slate-700/60 flex flex-col gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="text-teal font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal animate-ping" />
                    [AGENT TELEMETRY INGESTION ENGINE]
                  </div>
                  <div className="text-slate-300">
                    &gt; Machine ID: <span className="text-amber-400">{machine.code}</span> ({machine.name})
                  </div>
                  <div className="text-slate-300">
                    &gt; Signal Vectors Analyzed: Temperature, Vibration, Current, Voltage, RPM, Hydraulic Line Pressure.
                  </div>
                  {machine.activeIssues > 0 ? (
                    <div className="text-rose-400 font-semibold">
                      &gt; [ANOMALY DETECTED] Vibration waveform exceedance threshold (+38% vs baseline variance).
                    </div>
                  ) : (
                    <div className="text-emerald-400">
                      &gt; Baseline validation complete. All FFT harmonic frequency peaks within ±2% tolerance.
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <h4 className="font-head font-bold text-ink text-sm mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-teal" />
                    AI Root Cause Diagnostics Summary
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed mb-5">
                    {machine.activeIssues > 0
                      ? `Agent detected sustained mechanical vibration in drive shaft bearing assembly. FFT spectral analysis indicates potential early-stage inner raceway pitting on Drive Shaft B.`
                      : `Machine telemetry is operating normally within engineered specifications. Preventive maintenance is schedule-locked in MES.`}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate('/agents/maintenance')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal to-teal-deep text-white font-bold text-xs hover:shadow-[0_8px_20px_-6px_rgba(31,169,113,0.6)] transition-all flex items-center gap-2 shadow-md"
                    >
                      <Wrench className="w-4 h-4" />
                      <span>Launch Predictive Maintenance Agent</span>
                    </button>
                    <button
                      onClick={() => navigate('/agents/incident-investigation')}
                      className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-ink font-bold text-xs hover:border-teal hover:shadow-md transition-all flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-teal" />
                      <span>View Deep Incident Report</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mes' && (
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-7 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
              <h3 className="font-head font-bold text-lg text-ink mb-5">MES SQL Server Integration & Work Orders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <div className="font-bold text-ink mb-2.5">Active Work Order</div>
                  <div className="font-mono text-teal font-bold text-sm">WO-2026-88492</div>
                  <div className="text-muted mt-1.5">Part: High-Precision Cylinder Block B</div>
                  <div className="text-muted">Target Qty: 500 units • Completed: 342 units</div>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <div className="font-bold text-ink mb-2.5">Assigned Line Operator</div>
                  <div className="font-bold text-ink text-sm">{machine.operator}</div>
                  <div className="text-muted mt-1.5">Shift: Day Shift (06:00 - 14:00)</div>
                  <div className="text-muted">Certifications: Level 3 CNC Master Specialist</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-[20px] p-7 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
              <h3 className="font-head font-bold text-lg text-ink mb-5">Maintenance & Service Log</h3>
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                  <div>
                    <div className="font-bold text-ink">Last Scheduled Maintenance</div>
                    <div className="text-muted mt-0.5">
                      {machine.lastMaintenance} • Bearing lubrication & Filter Replacement
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                    Completed
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                  <div>
                    <div className="font-bold text-ink">Next Inspection Due</div>
                    <div className="text-muted mt-0.5">Scheduled for Oct 12, 2026</div>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-teal/10 text-teal border border-teal/25 font-bold text-[11px]">
                    Scheduled
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

/* --- Small helper components --- */

const KPI: React.FC<{ label: string; value: React.ReactNode; accent: string }> = ({ label, value, accent }) => (
  <div className="text-center">
    <div className="text-[10px] text-muted uppercase font-bold tracking-wider">{label}</div>
    <div className="font-mono text-2xl font-extrabold mt-1" style={{ color: accent }}>
      {value}
    </div>
  </div>
);

const Divider = () => <div className="w-[1px] h-9 bg-slate-200" />;