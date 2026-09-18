import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bot, MapPin, Wrench, Shield, FileText, Sparkles, Activity,
  Thermometer, Zap, Plug, Gauge as RpmIcon
} from 'lucide-react';
import { STATUS_DESCRIPTIONS } from '../data/machineMonitoringData';
import { TelemetryChart } from '../components/machine-monitoring/TelemetryChart';
import { HealthRing, STATUS_COLOR, STATUS_BG } from '../components/machine-monitoring/MachineCard';
import { useMachineStore } from '../store/useMachineStore';
import { machineMonitoringService } from '../services/api';

interface MachineAiIssue {
  id: number;
  title: string;
  severity: string;
  status: string;
  affected_parameters: string[];
  detected_at: string;
  persistence_seconds: number;
  analysis?: {
    issue_summary?: string;
    possible_causes?: string[];
    evidence?: Record<string, unknown>;
    reasoning_summary?: string;
    root_cause_confidence?: number;
    immediate_actions?: string[];
    corrective_actions?: string[];
    preventive_actions?: string[];
  } | null;
}

interface MachineAiPayload {
  summary: { text: string; generated_at: string; baseline?: Record<string, unknown> } | null;
  state: { operational_state: string; agent_state: string; last_checked_at: string } | null;
  active_issue: MachineAiIssue | null;
  issues: MachineAiIssue[];
  recommendations: Array<{ id: number; issue_id: number; action: string; category: string; status: string; generated_at: string }>;
}

/* ------------------------------------------------------------------ */
/*  Per-metric visual theme (matches the colored KPI cards in mockup)  */
/* ------------------------------------------------------------------ */
const METRIC_THEME: Record<
  string,
  { icon: React.ElementType; from: string; to: string; ring: string; text: string }
> = {
  temperature: { icon: Thermometer, from: '#FFD6CE', to: '#FFF1EE', ring: '#F4785A', text: '#B5432A' },
  vibration: { icon: Activity, from: '#F0D9FF', to: '#FAF1FF', ring: '#B76BF2', text: '#7C3AAB' },
  current: { icon: Zap, from: '#CFE3FF', to: '#EFF5FF', ring: '#4C86F0', text: '#2A5DBB' },
  power: { icon: Plug, from: '#FFE9BE', to: '#FFF7E8', ring: '#E7A93A', text: '#9C6A11' },
  rpm: { icon: RpmIcon, from: '#C9F2E4', to: '#EFFCF8', ring: '#1FA971', text: '#0F7A54' },
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
  const critical = criticalThreshold ?? warn;

  const aStart = angleFor(min);
  const aNormalEnd = angleFor(normalRange[1]);
  const aWarnEnd = angleFor(warn);
  const aCriticalEnd = angleFor(critical);
  const aEnd = angleFor(max);
  const needleAngle = angleFor(value);
  const needleTip = point(needleAngle, r - 14);

  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full h-auto">
      {/* track base */}
      <path d={arcPath(180, 0, r)} fill="none" stroke="#e7dcc0" strokeWidth="12" strokeLinecap="round" />
      {/* green (normal) */}
      {span > 0 && (
        <>
          <path d={arcPath(aStart, aNormalEnd, r)} fill="none" stroke="#00c475" strokeWidth="12" strokeLinecap="round" />
          {/* amber (warning) */}
          {aWarnEnd !== aNormalEnd && (
            <path d={arcPath(aNormalEnd, aWarnEnd, r)} fill="none" stroke="#D9A441" strokeWidth="12" />
          )}
          {/* red (critical) */}
          {aCriticalEnd !== aWarnEnd && (
            <path
              d={arcPath(aWarnEnd, aCriticalEnd, r)}
              fill="none"
              stroke="#B4342A"
              strokeWidth="12"
            />
          )}

          {/* remaining range after critical threshold */}
          {aEnd !== aCriticalEnd && (
            <path
              d={arcPath(aCriticalEnd, aEnd, r)}
              fill="none"
              stroke="#B4342A"
              strokeWidth="12"
              strokeLinecap="round"
            />
          )}
        </>
      )}
      {/* needle */}
      <line x1={cx} y1={cy} x2={needleTip[0]} y2={needleTip[1]} stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#ffffff00" stroke="#000000" strokeWidth="2" />
      {/* Min Tag */}
      <g>
        <rect
          x={point(180, r + 18)[0]}
          y={point(180, r + 18)[1]}
          width="38"
          height="18"
          rx="9"
          fill="#000000"
        />
        <text
          x={point(180, r + 22)[0] + 21}
          y={point(180, r + 30)[1] + 12}
          fontSize="9"
          fill="#ffffff"
          textAnchor="middle"
          fontWeight="600"
        >
          {fmt(min)}
        </text>
      </g>

      {/* Max Tag */}
      <g>
        <rect
          x={point(0, r + 18)[0] - 42}
          y={point(0, r + 18)[1]}
          width="42"
          height="18"
          rx="9"
          fill="#000000"
        />
        <text
          x={point(0, r + 18)[0] - 21}
          y={point(0, r + 18)[1] + 12}
          fontSize="9"
          fill="#ffffff"
          textAnchor="middle"
          fontWeight="600"
        >
          {fmt(max)}
        </text>
      </g>
    </svg>
  );
};

interface TabItem {
  key: 'telemetry' | 'agent' | 'mes' | 'maintenance';
  label: string;
  icon: React.ElementType;
  alert?: boolean;
}

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const storeMachines = useMachineStore((state) => state.machines);
  const updateMachineMetric = useMachineStore((state) => state.updateMachineMetric);

  const machine = useMemo(() => {
    return storeMachines.find((m) => m.id === id);
  }, [id, storeMachines]);

  const [activeTab, setActiveTab] = useState<'telemetry' | 'agent' | 'mes' | 'maintenance'>('telemetry');
  const [selectedMetric, setSelectedMetric] = useState<string>('vibration');
  const [aiData, setAiData] = useState<MachineAiPayload | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!id) return undefined;
    machineMonitoringService.getAi(id)
      .then((payload: MachineAiPayload) => {
        if (!cancelled) {
          setAiData(payload);
          setAiError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Machine AI state is unavailable';
          setAiError(message);
        }
      });
    return () => { cancelled = true; };
  }, [id]);

  if (!machine) {
    return <div className="p-6 text-sm text-slate-500">Live InfluxDB telemetry is not available.</div>;
  }

  const statusColor = STATUS_COLOR[machine.status];
  const currentMetricObj = machine.liveMetrics.find((m) => m.key === selectedMetric) || machine.liveMetrics[0];

  if (!currentMetricObj) {
    return <div className="p-6 text-sm text-slate-500">No telemetry signals are configured in InfluxDB.</div>;
  }

  const agentStatus = aiData?.state?.agent_state?.replaceAll('_', ' ') || 'LOADING';
  const activeIssue = aiData?.active_issue;
  const activeIssueCount = aiData ? aiData.issues.filter((issue) => issue.status !== 'RESOLVED').length : machine.activeIssues;

  const TABS: TabItem[] = [
    { key: 'telemetry', label: 'Live Telemetry & Signals', icon: Activity },
    { key: 'agent', label: 'AI Agent Root-Cause Analysis', icon: Bot, alert: activeIssueCount > 0 },
    { key: 'mes', label: 'MES Work Orders & Operator', icon: FileText },
    { key: 'maintenance', label: 'Maintenance & Service History', icon: Wrench },
  ];

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
          <KPI label="Active Issues" value={activeIssueCount} accent={activeIssueCount > 0 ? '#E24C4C' : '#059669'} />
          <Divider />
          <KPI label="OEE Impact" value="N/A" accent="#0F172A" />
          <Divider />
          <div className="text-center">
            <div className="text-[10px] text-muted uppercase font-bold tracking-wider">Agent Status</div>
            <div className="font-mono text-xs font-bold text-teal mt-1.5 flex items-center gap-1.5 justify-center bg-teal/10 px-2.5 py-1 rounded-full border border-teal/20">
              <Bot className="w-3.5 h-3.5" />
              {agentStatus}
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
                className={`relative px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${isActive ? 'text-navy-950' : 'text-muted hover:text-ink'
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
                    const liveVal = m.value ?? 0;
                    const liveStatus = m.status;
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
                          background: 'linear-gradient(160deg, #dfdfdf 0%, #ffffff 100%)',
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

                        <div className="font-mono font-extrabold text-lg mt-1" style={{ color: '#000000' }}>
                          {m.value === null ? 'N/A' : liveVal} <span className="text-[20px] font-semibold opacity-70">{m.unit}</span>
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
                  initialSeries={currentMetricObj.spark}
                  onLatestValue={(val) => {
                    updateMachineMetric(machine.id, currentMetricObj.key, val);
                  }}
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
                    <h3 className="font-head font-bold text-lg text-ink">Machine Intelligence</h3>
                    <p className="text-xs text-muted">
                      Backend monitoring state, evidence, and operator recommendations.
                    </p>
                  </div>
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal/15 to-teal/5 text-teal border border-teal/30 text-xs font-mono font-bold shadow-sm">
                  Status: {agentStatus}
                </span>
              </div>

              {aiError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">{aiError}</div>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-br from-slate-50 to-white shadow-sm">
                  <h4 className="font-head font-bold text-ink text-sm mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-teal" />
                    Machine AI Summary
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed mb-5">
                    {aiData?.summary?.text || 'The initial monitoring window has not produced a summary yet.'}
                  </p>
                  <div className="text-[11px] text-muted">Generated: {aiData?.summary ? new Date(aiData.summary.generated_at).toLocaleString() : 'Pending'}</div>
                </div>
                <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
                  <h4 className="font-head font-bold text-ink text-sm mb-3">Current AI State</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-muted">Operational</span><div className="font-bold text-ink mt-1">{aiData?.state?.operational_state || 'PENDING'}</div></div>
                    <div><span className="text-muted">Agent</span><div className="font-bold text-teal mt-1">{agentStatus}</div></div>
                    <div><span className="text-muted">Last checked</span><div className="font-mono text-ink mt-1">{aiData?.state ? new Date(aiData.state.last_checked_at).toLocaleString() : 'Pending'}</div></div>
                    <div><span className="text-muted">Active issue</span><div className="font-bold text-ink mt-1">{activeIssue ? activeIssue.status : 'None'}</div></div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
                <h4 className="font-head font-bold text-ink text-sm mb-3">Active Issue and Root-Cause Analysis</h4>
                {!activeIssue ? <p className="text-xs text-muted">No active application issue has been recorded.</p> : (
                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2"><strong className="text-ink">{activeIssue.title}</strong><span className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold">{activeIssue.severity}</span><span className="text-muted">{activeIssue.status}</span></div>
                    <div className="text-muted">Affected: {activeIssue.affected_parameters.join(', ') || 'Not available'} | Persistence: {Math.round(activeIssue.persistence_seconds)}s</div>
                    <p className="text-slate-700">{activeIssue.analysis?.issue_summary || 'Investigation is pending persistence and structured agent analysis.'}</p>
                    {activeIssue.analysis?.possible_causes?.length ? <div><strong>Possible causes:</strong> {activeIssue.analysis.possible_causes.join('; ')}</div> : null}
                    {activeIssue.analysis?.reasoning_summary ? <div><strong>Reasoning:</strong> {activeIssue.analysis.reasoning_summary}</div> : null}
                    {activeIssue.analysis?.root_cause_confidence != null ? <div><strong>Confidence:</strong> {Math.round(activeIssue.analysis.root_cause_confidence * 100)}%</div> : null}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
                  <h4 className="font-head font-bold text-ink text-sm mb-3">Recommendations</h4>
                  {aiData?.recommendations.length ? <div className="flex flex-col gap-2">{aiData.recommendations.slice(0, 8).map((recommendation) => <div key={recommendation.id} className="text-xs border-b border-slate-100 pb-2"><span className="font-bold text-teal mr-2">{recommendation.category}</span>{recommendation.action}</div>)}</div> : <p className="text-xs text-muted">No recommendations are pending.</p>}
                </div>
                <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
                  <h4 className="font-head font-bold text-ink text-sm mb-3">Operator Action</h4>
                  {activeIssue ? <>
                    <textarea value={actionText} onChange={(event) => setActionText(event.target.value)} placeholder="Record the action taken" className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-xs resize-y" />
                    <button disabled={!actionText.trim() || actionSaving} onClick={async () => { setActionSaving(true); try { await machineMonitoringService.recordOperatorAction(machine.id, activeIssue.id, actionText.trim()); setActionText(''); const payload = await machineMonitoringService.getAi(machine.id); setAiData(payload); } finally { setActionSaving(false); } }} className="mt-3 px-4 py-2 rounded-xl bg-teal text-white font-bold text-xs disabled:opacity-50">{actionSaving ? 'Recording...' : 'Record action'}</button>
                  </> : <p className="text-xs text-muted">Operator actions become available when an issue is recorded.</p>}
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