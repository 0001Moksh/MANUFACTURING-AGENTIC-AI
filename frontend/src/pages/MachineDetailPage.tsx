import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bot, Wrench, FileText, Sparkles, Activity,
  Thermometer, Zap, Plug, Gauge as RpmIcon, ChevronLeft as ChevronLeftIcon,
  ChevronRight, AlertTriangle, History, CheckCircle2, CircleSlash, X, RefreshCw,
  ChevronDown, Plus
} from 'lucide-react';
import { STATUS_DESCRIPTIONS } from '../data/machineMonitoringData';
import { TelemetryChart } from '../components/machine-monitoring/TelemetryChart';
import { HealthRing, STATUS_COLOR, STATUS_BG } from '../components/machine-monitoring/MachineCard';
import { useMachineStore } from '../store/useMachineStore';
import { machineMonitoringService } from '../services/api';
import { ThresholdManagerDrawer } from '../components/machine-monitoring/ThresholdManagerDrawer';
import { MachineDocumentsPanel } from '../components/machine-monitoring/MachineDocumentsPanel';

interface MachineAiIssue {
  id: number;
  title: string;
  severity: string;
  status: string;
  affected_parameters: string[];
  detected_at: string;
  persistence_seconds: number;
  resolved_at?: string | null;
  operator_action_taken?: string | null;
  resolved_by?: 'OPERATOR' | 'SYSTEM' | null;
  resolution_notes?: string | null;
  tags?: string[];
  context?: { metrics?: Record<string, MachineEvidenceMetric> } | null;
  analysis?: {
    issue_summary?: string;
    possible_causes?: string[];
    evidence?: { metrics?: Record<string, MachineEvidenceMetric> } | null;
    reasoning_summary?: string;
    root_cause_confidence?: number;
    immediate_actions?: string[];
    corrective_actions?: string[];
    preventive_actions?: string[];
  } | null;
}

interface MachineEvidenceMetric {
  value?: number | null;
  unit?: string | null;
  status?: string | null;
  minimum?: number | null;
  maximum?: number | null;
  average?: number | null;
  trend?: string | null;
  samples?: number | null;
  warning_threshold?: number | null;
  critical_threshold?: number | null;
}

interface MachineAiPayload {
  summary: {
    text: string;
    generated_at: string;
    model_name?: string;
    snapshot?: Record<string, unknown>;
    baseline?: Record<string, unknown>;
    llm_trace?: Record<string, unknown>;
  } | null;
  state: {
    operational_state: string;
    agent_state: string;
    last_checked_at: string;
    parameter_states?: Record<string, string>;
  } | null;
  active_issue: MachineAiIssue | null;
  issues: MachineAiIssue[];
  recommendations: Array<{
    id: number;
    issue_id: number;
    action: string;
    category: string;
    status: string;
    generated_at: string;
    operator_action?: string | null;
    source_chunks?: Array<{
      document_id: number;
      title: string;
      filename: string;
      category: string;
      chunk_index: number;
      content: string;
      score: number;
    }>;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Agent tab helpers                                                  */
/* ------------------------------------------------------------------ */
const ACTIVE_ISSUE_STATUSES = [
  'ACTIVE',
  'OPEN',
  'INVESTIGATION',
  'RECOMMENDATION',
  'VERIFYING',
  'RE_OCCURRENCE',
];

/** Parses the LLM summary payload (JSON string or object) into a plain object. */
const parseAiSummary = (aiData: MachineAiPayload | null): any | null => {
  if (!aiData?.summary) return null;
  try {
    const llmContent = (aiData.summary.llm_trace as any)?.response?.choices?.[0]?.message?.content;
    const raw = llmContent || aiData.summary.text;
    if (typeof raw === 'string') return JSON.parse(raw);
    if (raw && typeof raw === 'object') return raw;
  } catch {
    // ignore parse errors
  }
  return null;
};

/** Turns a summary entry (string or object) into one readable line. */
const formatSummaryEntry = (entry: any): string => {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';
  return [
    entry.metric,
    entry.value != null ? `${entry.value}` : null,
    entry.status,
    entry.threshold != null ? `threshold ${entry.threshold}` : null,
    entry.trend,
  ]
    .filter(Boolean)
    .join(' · ');
};

const severityClass = (severity: string) =>
  severity === 'HIGH_RISK' || severity === 'CRITICAL'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

/* ------------------------------------------------------------------ */
/*  Per-metric visual theme                                            */
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
/*  Clean semicircle gauge                                             */
/* ------------------------------------------------------------------ */
const GaugeDial: React.FC<{
  min: number;
  max: number;
  value: number;
  normalRange: [number, number];
  warningThreshold?: number;
  criticalThreshold?: number;
}> = ({ min, max, value, normalRange, warningThreshold, criticalThreshold }) => {
  const W = 150;
  const H = 88;
  const cx = W / 2;
  const cy = H - 4;
  const r = 58;

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const span = max - min || 1;
  const angleFor = (v: number) => 180 - ((clamp(v) - min) / span) * 180;

  const point = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy - radius * Math.sin(rad)];
  };

  const arcPath = (a1: number, a2: number, radius: number) => {
    const [x1, y1] = point(a1, radius);
    const [x2, y2] = point(a2, radius);
    const largeArc = Math.abs(a1 - a2) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

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
  const needleTip = point(needleAngle, r - 12);

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-auto max-w-[150px]">
      <path d={arcPath(180, 0, r)} fill="none" stroke="#E5E7EB" strokeWidth="11" strokeLinecap="round" />
      <path d={arcPath(aStart, aNormalEnd, r)} fill="none" stroke="#10B981" strokeWidth="11" strokeLinecap="round" />
      {aWarnEnd !== aNormalEnd && (
        <path d={arcPath(aNormalEnd, aWarnEnd, r)} fill="none" stroke="#F59E0B" strokeWidth="11" />
      )}
      {aCriticalEnd !== aWarnEnd && (
        <path d={arcPath(aWarnEnd, aCriticalEnd, r)} fill="none" stroke="#EF4444" strokeWidth="11" />
      )}
      {aEnd !== aCriticalEnd && (
        <path d={arcPath(aCriticalEnd, aEnd, r)} fill="none" stroke="#EF4444" strokeWidth="11" strokeLinecap="round" />
      )}
      <line x1={cx} y1={cy} x2={needleTip[0]} y2={needleTip[1]} stroke="#1E293B" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4.5" fill="#fff" stroke="#1E293B" strokeWidth="1.8" />
      <g>
        <rect x={2} y={H - 2} width="36" height="16" rx="8" fill="#1E293B" />
        <text x={20} y={H + 10} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="600">
          {fmt(min)}
        </text>
      </g>
      <g>
        <rect x={W - 38} y={H - 2} width="36" height="16" rx="8" fill="#1E293B" />
        <text x={W - 20} y={H + 10} fontSize="9" fill="#fff" textAnchor="middle" fontWeight="600">
          {fmt(max)}
        </text>
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Horizontal scrollable gauge row                                    */
/* ------------------------------------------------------------------ */
const GaugeRow: React.FC<{
  title: string;
  metrics: any[];
  plottedKeys: string[];
  onToggle: (key: string) => void;
}> = ({ title, metrics, plottedKeys, onToggle }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  if (!metrics.length) return null;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-slate-700">{title}</h3>
        <div className=" flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className="w-7 h-7 rounded-lg border  border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {metrics.map((m) => {
          const liveVal = m.value ?? 0;
          const liveStatus = m.status || 'normal';
          const isSelected = plottedKeys.includes(m.key);
          const theme = METRIC_THEME[m.key] ?? DEFAULT_THEME;
          const Icon = theme.icon;

          const configuredRange = m.normalRange ?? [0, Math.max(Math.abs(liveVal) * 1.3, 1)];
          const hasCritical = m.criticalThreshold != null;
          const hasWarning = m.warningThreshold != null;

          const axisMax = hasCritical
            ? (m.criticalThreshold as number) * 1.1
            : hasWarning
              ? (m.warningThreshold as number) * 1.2
              : configuredRange[1] * 1.15;

          const statusColor =
            liveStatus === 'critical'
              ? '#EF4444'
              : liveStatus === 'warning'
                ? '#F59E0B'
                : liveStatus === 'unavailable'
                  ? '#64748B'
                  : '#10B981';

          return (
            <motion.div
              key={m.key}
              onClick={() => onToggle(m.key)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative shrink-0 w-[168px] rounded-xl border bg-white p-3 flex flex-col items-center cursor-pointer transition-all"
              style={{
                borderColor: isSelected ? '#0D9488' : '#E2E8F0',
                boxShadow: isSelected
                  ? '0 0 0 2px rgba(13,148,136,0.18), 0 6px 16px -8px rgba(15,23,42,0.2)'
                  : '0 2px 8px -4px rgba(15,23,42,0.08)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1 w-full justify-center">
                <Icon className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[11px] font-bold text-slate-700 truncate max-w-[110px]">
                  {m.label}
                </span>
              </div>

              <GaugeDial
                min={configuredRange[0]}
                max={axisMax}
                value={liveVal}
                normalRange={configuredRange}
                warningThreshold={m.warningThreshold ?? undefined}
                criticalThreshold={m.criticalThreshold ?? undefined}
              />

              <div className="font-mono font-extrabold text-[15px] text-slate-800 mt-0.5">
                {m.value === null ? 'N/A' : liveVal}
                <span className="text-[10px] font-semibold text-slate-400 ml-0.5">{m.unit}</span>
              </div>

              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold capitalize" style={{ color: statusColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                {liveStatus}
              </div>

              <div className="text-[9.5px] text-slate-400 mt-0.5 truncate w-full text-center">
                {m.normalRange ? `Normal: ${m.normalRange[0]}-${m.normalRange[1]}` : 'No threshold'}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
interface TabItem {
  key: 'telemetry' | 'agent' | 'mes' | 'maintenance' | 'documents';
  label: string;
  icon: React.ElementType;
  alert?: boolean;
}

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const storeMachines = useMachineStore((state) => state.machines);
  const loadMachinesForDetail = useMachineStore((state) => state.loadMachines);

  const machine = useMemo(() => storeMachines.find((m) => m.id === id), [id, storeMachines]);

  const [activeTab, setActiveTab] = useState<'telemetry' | 'agent' | 'mes' | 'maintenance' | 'documents'>('telemetry');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [aiData, setAiData] = useState<MachineAiPayload | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [operatorActions, setOperatorActions] = useState<Record<number, string>>({});
  const [actionSavingIssueId, setActionSavingIssueId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyIssues, setHistoryIssues] = useState<MachineAiIssue[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [summaryRegenerating, setSummaryRegenerating] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);
  const [documentUploadSignal, setDocumentUploadSignal] = useState(0);

  // Agent tab – collapsible Active Issues section
  const [issuesOpen, setIssuesOpen] = useState(true);

  // Per-issue Document evidence collapse state (default collapsed)
  const [evidenceOpenMap, setEvidenceOpenMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    if (!id) return undefined;

    machineMonitoringService
      .getAi(id)
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

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Refresh AI data when intelligence tab is opened
  useEffect(() => {
    if (activeTab !== 'agent' || !id) return;
    let cancelled = false;

    const refreshAi = () => {
      machineMonitoringService
        .getAi(id)
        .then((payload: MachineAiPayload) => {
          if (!cancelled) {
            setAiData(payload);
            setAiError(null);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setAiError(error instanceof Error ? error.message : 'Machine AI state is unavailable');
          }
        });
    };

    refreshAi();
    const refreshTimer = window.setInterval(refreshAi, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [activeTab, id]);

  if (!machine) {
    return (
      <div className="p-6 text-sm text-slate-500">
        Loading machine details, or the requested machine is no longer available.
      </div>
    );
  }

  const sanitizedMachineName =
    machine.name.replace(/^InfluxDB\s+Machine\s*/i, '').trim() || machine.code;
  const statusColor = STATUS_COLOR[machine.status];
  const firstMetric = machine.liveMetrics[0];

  if (!firstMetric) {
    return (
      <div className="p-6 text-sm text-slate-500">
        No telemetry signals are configured in InfluxDB.
      </div>
    );
  }

  const selectedKeys = selectedMetrics.filter((key) =>
    machine.liveMetrics.some((metric) => metric.key === key)
  );
  const plottedKeys = selectedKeys.length ? selectedKeys : [firstMetric.key];
  const MAX_SELECTED = 8;

  const toggleMetric = (key: string) => {
    if (plottedKeys.includes(key)) {
      if (plottedKeys.length === 1) return;
      setSelectedMetrics(plottedKeys.filter((item) => item !== key));
      return;
    }
    if (plottedKeys.length < MAX_SELECTED) {
      setSelectedMetrics([...plottedKeys, key]);
    }
  };

  // Group metrics
  const voltageMetrics = machine.liveMetrics.filter(
    (m) =>
      m.key.toLowerCase().includes('volt') ||
      m.label.toLowerCase().includes('volt') ||
      m.unit?.toLowerCase() === 'v'
  );
  const currentMetrics = machine.liveMetrics.filter(
    (m) =>
      m.key.toLowerCase().includes('current') ||
      m.key.toLowerCase().includes('amp') ||
      m.label.toLowerCase().includes('current') ||
      m.unit?.toLowerCase() === 'a'
  );
  const otherMetrics = machine.liveMetrics.filter(
    (m) => !voltageMetrics.includes(m) && !currentMetrics.includes(m)
  );

  const agentStatus = aiData?.state?.agent_state?.replaceAll('_', ' ') || 'LOADING';
  const activeIssue = aiData?.active_issue;
  const activeIssues =
    aiData?.issues.filter((issue) => ACTIVE_ISSUE_STATUSES.includes(issue.status)) ?? [];
  const activeIssueCount = aiData ? activeIssues.length : machine.activeIssues;

  // Agent tab derived data
  const aiSummary = parseAiSummary(aiData);

  const summaryLines = (list: unknown): string[] =>
    Array.isArray(list) ? list.map(formatSummaryEntry).filter(Boolean) : [];
  const summaryActiveIssues = summaryLines(aiSummary?.active_issues);
  const keyObservations = summaryLines(aiSummary?.key_observations);

  const openIssueHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const response = await machineMonitoringService.getIssueHistory(machine.id);
      setHistoryIssues(response.issues ?? []);
      setActionError(null);
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Unable to load issue history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const regenerateSummary = async () => {
    setSummaryRegenerating(true);
    setAiError(null);
    try {
      const result = await machineMonitoringService.regenerateSummary(machine.id);
      setAiData((current) => (current ? { ...current, summary: result.summary } : current));
    } catch (error: unknown) {
      setAiError(
        error instanceof Error ? error.message : 'Unable to regenerate the machine summary.'
      );
    } finally {
      setSummaryRegenerating(false);
    }
  };

  const recordOperatorAction = async (issue: MachineAiIssue) => {
    const action = (operatorActions[issue.id] ?? '').trim();
    if (!action) return;
    setActionSavingIssueId(issue.id);
    setActionError(null);
    try {
      await machineMonitoringService.recordOperatorAction(machine.id, issue.id, action);
      setOperatorActions((current) => ({ ...current, [issue.id]: '' }));
      setAiData(await machineMonitoringService.getAi(machine.id));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Unable to resolve this issue.');
    } finally {
      setActionSavingIssueId(null);
    }
  };

  const ignoreIssue = async (issue: MachineAiIssue) => {
    if (!window.confirm(`Ignore “${issue.title}”? It will be retained in issue history.`)) return;
    setActionSavingIssueId(issue.id);
    setActionError(null);
    try {
      await machineMonitoringService.ignoreIssue(
        machine.id,
        issue.id,
        (operatorActions[issue.id] ?? '').trim() || undefined
      );
      setAiData(await machineMonitoringService.getAi(machine.id));
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Unable to ignore this issue.');
    } finally {
      setActionSavingIssueId(null);
    }
  };

  const TABS: TabItem[] = [
    { key: 'telemetry', label: 'Live Telemetry', icon: Activity },
    { key: 'agent', label: 'AI Agent Root-Cause', icon: Bot, alert: activeIssueCount > 0 },
    { key: 'mes', label: 'Work Orders', icon: FileText },
    { key: 'maintenance', label: 'Service History', icon: Wrench },
    { key: 'documents', label: 'Repair Document', icon: FileText },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-[#F4F6F9]"
    >
      <div className="max-w-[1500px] mx-auto px-5 sm:px-6 py-5 flex flex-col gap-5">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
            <button
              onClick={() => navigate('/machine-monitoring')}
              className="group hover:text-teal flex items-center gap-1 font-medium transition-colors"
            >
              <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              Back to Machine Monitoring
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-800 font-semibold">{sanitizedMachineName}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold">
              {machine.code}
            </span>
            <span
              className="px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5"
              style={{ background: STATUS_BG[machine.status], color: statusColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusColor }} />
              {machine.status}
            </span>
          </div>
        </div>

        {/* Hero Card */}
        <div className="relative bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] flex flex-col lg:flex-row lg:items-center justify-between gap-5 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-teal via-emerald-400 to-teal/40" />

          <div className="flex items-start gap-4 min-w-0">
            <div className="relative shrink-0">
              <HealthRing score={machine.healthScore} status={machine.status} size={72} />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center border border-slate-100">
                <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-head text-[22px] sm:text-[24px] font-extrabold text-slate-900 tracking-tight">
                  {sanitizedMachineName}
                </h1>
              </div>

              <p className="text-[12.5px] text-slate-600 mt-2 max-w-2xl leading-relaxed">
                {STATUS_DESCRIPTIONS[machine.status]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 lg:border-l lg:border-slate-200 lg:pl-6 shrink-0">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Issues</div>
              <div
                className="font-mono text-[26px] font-extrabold mt-0.5"
                style={{ color: activeIssueCount > 0 ? '#EF4444' : '#10B981' }}
              >
                {activeIssueCount}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Agent Status</div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal/10 text-teal border border-teal/20 text-[11px] font-bold">
                <Bot className="w-3.5 h-3.5" />
                {agentStatus}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 text-[13px] font-semibold shadow-sm">
            {TABS.map(({ key, label, icon: Icon, alert }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-slate-900 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                    {alert && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Add repair document"
              title="Add repair document"
              onClick={() => { setActiveTab('documents'); setDocumentUploadSignal((value) => value + 1); }}
              className="rounded-lg px-2.5 py-2 text-teal transition-colors hover:bg-teal/10"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setThresholdsOpen(true)}
            className="rounded-xl border border-teal/30 bg-white px-3.5 py-2 text-[12px] font-bold text-teal shadow-sm hover:bg-teal/5 transition-colors"
          >
            Set Thresholds
          </button>
        </div>

        {thresholdsOpen && (
          <ThresholdManagerDrawer
            machineId={machine.id}
            metrics={machine.liveMetrics}
            onClose={() => setThresholdsOpen(false)}
            onSaved={() => {
              setThresholdsOpen(false);
              void loadMachinesForDetail();
            }}
          />
        )}

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {activeTab === 'telemetry' && (
              <div className="flex flex-col gap-5">
                {/* Key Indicators - Horizontal Scroll Rows */}
                <div>
                  <div>

                    <GaugeRow
                      title="Voltage"
                      metrics={voltageMetrics}
                      plottedKeys={plottedKeys}
                      onToggle={toggleMetric}
                    />
                    <GaugeRow
                      title="Current"
                      metrics={currentMetrics}
                      plottedKeys={plottedKeys}
                      onToggle={toggleMetric}
                    />
                    <GaugeRow
                      title="Other Sensors"
                      metrics={otherMetrics}
                      plottedKeys={plottedKeys}
                      onToggle={toggleMetric}
                    />

                    {voltageMetrics.length === 0 &&
                      currentMetrics.length === 0 &&
                      otherMetrics.length === 0 && (
                        <div className="text-sm text-slate-500 py-8 text-center">
                          No metrics available
                        </div>
                      )}
                  </div>
                </div>

                <TelemetryChart
                  signals={machine.liveMetrics}
                  selectedKeys={plottedKeys}
                  onToggleSignal={toggleMetric}
                  maxSelected={MAX_SELECTED}
                />

              </div>
            )}
            {/* ================================================================
                AI AGENT ROOT-CAUSE TAB
                Order:
                  1. Machine Intelligence header (+ status & health score)
                  2. Active Issues & Root-Cause (collapsible, History)
                  3. AI summary text
                  4. Key Observations | Active Issues + Data Quality
                  5. Recommended Action
                  6. Current AI State
               ================================================================ */}
            {activeTab === 'agent' && (
              <div className="flex flex-col gap-5">
                {/* 1 ── Header ─────────────────────────────────────────── */}
                <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-4 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center text-teal">
                        <Bot className="w-5 h-5" />
                      </div>

                      <div>
                        <h3 className="font-head font-bold text-[16px] text-slate-800">
                          Machine Intelligence
                        </h3>

                        <p className="text-[12px] text-slate-500">
                          Live monitoring summary, evidence & recommendations
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => void regenerateSummary()}
                        disabled={summaryRegenerating}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-white px-3 py-1.5 text-[11px] font-bold text-teal hover:bg-teal/5 disabled:opacity-50 transition-colors"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${summaryRegenerating ? 'animate-spin' : ''
                            }`}
                        />

                        {summaryRegenerating
                          ? 'Regenerating…'
                          : 'Regenerate'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error */}
                {aiError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[12.5px] text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    {aiError}
                  </div>
                )}

                {/* 2 ── Active Issues & Root-Cause (collapsible) ───────── */}
                <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-5 py-3.5">
                    <div>
                      <h4 className="font-head font-bold text-slate-800 text-[14px]">
                        Active Issues & Root-Cause
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Issue-specific recommendations and operator workflow
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void openIssueHistory()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-teal transition-colors"
                      >
                        <History className="h-3.5 w-3.5" />
                        History
                      </button>
                      <button
                        onClick={() => setIssuesOpen((open) => !open)}
                        aria-expanded={issuesOpen}
                        aria-label={issuesOpen ? 'Collapse active issues' : 'Expand active issues'}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${issuesOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {issuesOpen && (
                      <motion.div
                        key="issues-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-slate-100">
                          {activeIssues.length === 0 ? (
                            <div className="p-10 text-center text-[13px] text-slate-500">
                              No active issues. Healthy telemetry continues to be monitored.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {activeIssues.map((issue) => {
                                const recommendations =
                                  aiData?.recommendations.filter((rec) => rec.issue_id === issue.id) ?? [];
                                const action = operatorActions[issue.id] ?? '';
                                const isSaving = actionSavingIssueId === issue.id;
                                const isEvidenceOpen = evidenceOpenMap[issue.id] ?? false;

                                return (
                                  <div
                                    key={issue.id}
                                    className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2"
                                  >
                                    {/* Left – issue details */}
                                    <div>
                                      <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <strong className="text-[13.5px] text-slate-800">
                                          {issue.title}
                                        </strong>
                                        <span
                                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${severityClass(issue.severity)}`}
                                        >
                                          {issue.severity}
                                        </span>
                                      </div>

                                      <div className="space-y-1.5 text-[12px] text-slate-600">
                                        <p>
                                          <span className="text-slate-400">Detected:</span>{' '}
                                          {new Date(issue.detected_at).toLocaleString()}
                                        </p>
                                        <p>
                                          <span className="text-slate-400">Affected:</span>{' '}
                                          {issue.affected_parameters.join(', ') || 'N/A'}
                                        </p>
                                        <p>
                                          <span className="text-slate-400">Persistence:</span>{' '}
                                          {Math.round(issue.persistence_seconds)}s
                                        </p>
                                      </div>

                                      <p className="mt-3.5 text-[12.5px] leading-relaxed text-slate-700">
                                        {issue.analysis?.issue_summary ||
                                          'The monitoring agent is collecting evidence for this threshold condition.'}
                                      </p>

                                      {issue.analysis?.possible_causes?.length ? (
                                        <p className="mt-2 text-[12px] text-slate-500">
                                          <span className="font-semibold text-slate-600">Possible causes:</span>{' '}
                                          {issue.analysis.possible_causes.join('; ')}
                                        </p>
                                      ) : null}
                                    </div>

                                    {/* Right – recommendations + operator action */}
                                    <div className="border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                                      <p className="mb-2.5 text-[10.5px] font-bold uppercase tracking-wider text-teal">
                                        Recommended action
                                      </p>

                                      {recommendations.length ? (
                                        <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                          {recommendations.map((rec) => (
                                            <li
                                              key={rec.id}
                                              className="rounded-lg bg-teal-50/60 border border-teal/10 px-3 py-2 text-[12px] text-slate-700"
                                            >
                                              <span className="font-bold text-teal mr-1.5">
                                                {rec.category}:
                                              </span>
                                              {rec.action}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-[12.5px] text-slate-500">
                                          Recommendation is being prepared by the monitoring agent.
                                        </p>
                                      )}

                                      {/* ── Document evidence (collapsible, default collapsed) ── */}
                                      {recommendations[0]?.source_chunks?.length ? (
                                        <div className="mt-3 rounded-xl border border-black overflow-hidden">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEvidenceOpenMap((prev) => ({
                                                ...prev,
                                                [issue.id]: !isEvidenceOpen,
                                              }))
                                            }
                                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-teal/[0.06] transition-colors"
                                          >
                                            <p className="text-[10px] font-extrabold uppercase tracking-wide text-teal">
                                              Data Source - {recommendations[0].source_chunks.length} chunks
                                            </p>
                                            <ChevronDown
                                              className={`h-3.5 w-3.5 shrink-0 text-teal transition-transform duration-200 ${isEvidenceOpen ? 'rotate-180' : ''
                                                }`}
                                            />
                                          </button>

                                          {isEvidenceOpen && (
                                            <div className="border-t border-teal/15 px-3 pb-3 pt-2 space-y-2">
                                              {recommendations[0].source_chunks.map((source) => (
                                                <div
                                                  key={`${source.document_id}-${source.chunk_index}`}
                                                  className="border-l-2 border-teal/40 pl-2.5"
                                                >
                                                  <p className="text-[11px] font-bold text-slate-700">
                                                    {source.category} · {source.title}
                                                    <span className="ml-1 font-normal text-slate-400">
                                                      chunk {source.chunk_index + 1}
                                                    </span>
                                                  </p>
                                                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">
                                                    {source.content.slice(0, 220)}
                                                    {source.content.length > 220 ? '…' : ''}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="mt-3 text-[10.5px] text-amber-700">
                                          No indexed machine-document evidence was available; this recommendation is limited to live telemetry.
                                        </p>
                                      )}

                                      <textarea
                                        value={action}
                                        onChange={(e) =>
                                          setOperatorActions((current) => ({
                                            ...current,
                                            [issue.id]: e.target.value,
                                          }))
                                        }
                                        placeholder="Document the physical action taken to resolve this issue…"
                                        className="mt-3.5 min-h-[72px] w-full resize-y rounded-xl border border-slate-200 p-3 text-[12.5px] outline-none focus:border-teal/40 focus:ring-1 focus:ring-teal/20"
                                      />

                                      <div className="mt-2.5 flex flex-wrap gap-2">
                                        <button
                                          disabled={!action.trim() || isSaving}
                                          onClick={() => void recordOperatorAction(issue)}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3.5 py-2 text-[11.5px] font-bold text-white hover:bg-teal/90 disabled:opacity-45 transition-colors"
                                        >
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          {isSaving ? 'Saving…' : 'Action performed / Resolve'}
                                        </button>

                                        <button
                                          disabled={isSaving}
                                          onClick={() => void ignoreIssue(issue)}
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-45 transition-colors"
                                        >
                                          <CircleSlash className="h-3.5 w-3.5" />
                                          Ignore
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {actionError && (
                            <p className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-[12.5px] text-rose-700">
                              {actionError}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ============================================================
    MACHINE AI SUMMARY CONTENT
============================================================ */}

                <div className="space-y-2">

                  {/* ============================================================
      3 — AI SUMMARY TEXT
  ============================================================ */}

                  <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">

                    {aiSummary ? (
                      <p className="text-[14px] leading-relaxed text-slate-800">
                        {aiSummary.summary_text}
                      </p>
                    ) : (
                      <p className="py-4 text-center text-[12.5px] text-slate-500">
                        Monitoring data is being processed. AI summary will appear shortly.
                      </p>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-[10.5px] text-slate-400">
                        Generated{' '}
                        <span className="font-mono">
                          {aiData?.summary?.generated_at
                            ? new Date(
                              aiData.summary.generated_at
                            ).toLocaleString()
                            : 'Pending'}
                        </span>

                        {aiData?.summary?.model_name
                          ? ` · ${aiData.summary.model_name}`
                          : ''}
                      </p>
                    </div>

                  </section>


                  {/* ============================================================
      4 — KEY OBSERVATIONS + ACTIVE ISSUES
  ============================================================ */}

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">

                    {/* ==========================================================
        KEY OBSERVATIONS
    ========================================================== */}

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">

                      <div className="mb-4 flex items-center justify-between gap-2">

                        <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Key Observations
                        </h4>

                        <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-semibold text-teal-700">
                          {keyObservations.length}
                        </span>

                      </div>

                      {keyObservations.length ? (

                        <ul className="space-y-3">

                          {keyObservations.map((line, i) => (

                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-slate-700"
                            >

                              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />

                              <span className="min-w-0">
                                {line}
                              </span>

                            </li>

                          ))}

                        </ul>

                      ) : (

                        <p className="text-[12.5px] text-slate-500">
                          No observations yet.
                        </p>

                      )}

                    </section>


                    {/* ==========================================================
        ACTIVE ISSUES + DATA QUALITY
    ========================================================== */}

                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">

                      <div className="mb-4 flex items-center justify-between gap-2">

                        <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Active Issues
                        </h4>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${summaryActiveIssues.length
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                          {summaryActiveIssues.length}
                        </span>

                      </div>

                      {summaryActiveIssues.length ? (

                        <ul className="space-y-3">

                          {summaryActiveIssues.map((line, i) => (

                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-slate-700"
                            >

                              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />

                              <span className="min-w-0">
                                {line}
                              </span>

                            </li>

                          ))}

                        </ul>

                      ) : (

                        <p className="text-[12.5px] text-slate-500">
                          No active issues reported.
                        </p>

                      )}


                      {/* DATA QUALITY */}

                      <div className="mt-5 border-t border-slate-100 pt-4">

                        <h4 className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                          Data Quality
                        </h4>

                        <p className="text-[12.5px] leading-relaxed text-slate-600">
                          {aiSummary?.data_quality ||
                            'Data quality has not been assessed yet.'}
                        </p>

                      </div>

                    </section>

                  </div>


                  {/* ============================================================
      5 — RECOMMENDED ACTION
  ============================================================ */}

                  {aiSummary?.recommended_action && (

                    <section className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.04)]">

                      <div className="mb-2 flex items-center gap-2">

                        <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-teal-700">
                          Recommended Action
                        </h4>

                      </div>

                      <p className="text-[13px] leading-relaxed text-teal-900">
                        {aiSummary.recommended_action}
                      </p>

                    </section>

                  )}

                </div>
                {/* 6 ── Current AI State ──────────────────────────────── */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
                  <h4 className="font-head font-bold text-slate-800 text-[13px] mb-4">
                    Current AI State
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-slate-400 text-[11px]">Operational</span>
                      <div className="font-bold text-slate-800 mt-1 text-[13px]">
                        {aiData?.state?.operational_state || 'PENDING'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Agent</span>
                      <div className="font-bold text-teal mt-1 text-[13px]">{agentStatus}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Last checked</span>
                      <div className="font-mono text-slate-700 mt-1 text-[12px]">
                        {aiData?.state
                          ? new Date(aiData.state.last_checked_at).toLocaleString()
                          : 'Pending'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Active issue</span>
                      <div className="font-bold text-slate-800 mt-1 text-[13px]">
                        {activeIssue ? activeIssue.status : 'None'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Issue History Drawer ───────────────────────────── */}
                <AnimatePresence>
                  {historyOpen && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
                      onClick={() => setHistoryOpen(false)}
                    >
                      <motion.aside
                        initial={{ x: 420 }}
                        animate={{ x: 0 }}
                        exit={{ x: 420 }}
                        transition={{ type: 'spring', bounce: 0.12 }}
                        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                          <div>
                            <h4 className="font-head text-[16px] font-extrabold text-slate-800">
                              Issue History
                            </h4>
                            <p className="mt-0.5 text-[11.5px] text-slate-500">
                              Resolved, system-resolved and ignored issues
                            </p>
                          </div>
                          <button
                            onClick={() => setHistoryOpen(false)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="p-5">
                          {historyLoading ? (
                            <p className="py-10 text-center text-[12.5px] text-slate-400">
                              Loading issue history…
                            </p>
                          ) : historyIssues.length === 0 ? (
                            <p className="py-10 text-center text-[12.5px] text-slate-500">
                              No historical issues for this machine.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {historyIssues.map((issue) => {
                                const systemResolved =
                                  issue.status === 'RESOLVED_BY_SYSTEM' ||
                                  issue.tags?.includes('SYSTEM_AUTO_RESOLVED');
                                const ignored = issue.status === 'IGNORED';

                                return (
                                  <div
                                    key={issue.id}
                                    className="rounded-xl border border-slate-200 p-4"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="text-[13px] font-bold text-slate-800">
                                          {issue.title}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-500">
                                          Detected {new Date(issue.detected_at).toLocaleString()}
                                        </p>
                                      </div>
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ignored
                                          ? 'bg-amber-50 text-amber-700'
                                          : systemResolved
                                            ? 'bg-sky-50 text-sky-700'
                                            : 'bg-emerald-50 text-emerald-700'
                                          }`}
                                      >
                                        {ignored
                                          ? 'Ignored'
                                          : systemResolved
                                            ? 'Resolved by system'
                                            : 'Resolved by operator'}
                                      </span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px] text-slate-600">
                                      <p>
                                        <b>Severity:</b> {issue.severity}
                                      </p>
                                      <p>
                                        <b>Resolved:</b>{' '}
                                        {issue.resolved_at
                                          ? new Date(issue.resolved_at).toLocaleString()
                                          : '—'}
                                      </p>
                                    </div>

                                    {issue.operator_action_taken && (
                                      <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] text-emerald-800">
                                        <b>Operator action:</b> {issue.operator_action_taken}
                                      </p>
                                    )}

                                    {issue.resolution_notes && !issue.operator_action_taken && (
                                      <p className="mt-3 text-[11.5px] text-slate-600">
                                        <b>Resolution note:</b> {issue.resolution_notes}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.aside>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {activeTab === 'mes' && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
                <h3 className="font-head font-bold text-[16px] text-slate-800 mb-4">
                  MES Work Orders & Operator
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12.5px]">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="font-bold text-slate-800 mb-2">Active Work Order</div>
                    <div className="font-mono text-teal font-bold text-[13px]">WO-2026-88492</div>
                    <div className="text-slate-500 mt-1">Part: High-Precision Cylinder Block B</div>
                    <div className="text-slate-500">Target: 500 units • Completed: 342</div>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    <div className="font-bold text-slate-800 mb-2">Assigned Operator</div>
                    <div className="font-bold text-slate-800">{machine.operator || 'Not assigned'}</div>
                    <div className="text-slate-500 mt-1">Shift: Day (06:00 – 14:00)</div>
                    <div className="text-slate-500">Certifications: Level 3 CNC Master</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
                <h3 className="font-head font-bold text-[16px] text-slate-800 mb-4">
                  Maintenance & Service History
                </h3>
                <div className="space-y-3 text-[12.5px]">
                  <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50/40">
                    <div>
                      <div className="font-bold text-slate-800">Last Scheduled Maintenance</div>
                      <div className="text-slate-500 mt-0.5">
                        {machine.lastMaintenance || '—'} • Bearing lubrication & Filter Replacement
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                      Completed
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50/40">
                    <div>
                      <div className="font-bold text-slate-800">Next Inspection Due</div>
                      <div className="text-slate-500 mt-0.5">Scheduled for Oct 12, 2026</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-teal/10 text-teal border border-teal/20 font-bold text-[11px]">
                      Scheduled
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'documents' && <MachineDocumentsPanel machineId={machine.id} openUploadSignal={documentUploadSignal} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};