import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, Bell, Calendar, CheckCircle2, ChevronLeft, ChevronRight,
  CircleHelp, Download, Maximize2, Minimize2, Pause, Play, RefreshCw, RotateCcw, RotateCw,
  Search, Thermometer, Waves, X, Zap, ZoomIn, ZoomOut,
} from 'lucide-react';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { LiveMetric, Machine } from '../data/machineMonitoringData';
import { useMachineStore } from '../store/useMachineStore';
import { EnergyAgentChatWidget } from '../components/agents/EnergyAgentChatWidget';

/* -------------------------------------------------------------------------- */
/*  Types & constants                                                         */
/* -------------------------------------------------------------------------- */

type MetricDefinition = {
  key: string;
  label: string;
  shortLabel: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  sum?: boolean;
};

type RangePreset = '1h' | '6h' | '24h' | '7d' | '30d' | 'all' | 'custom';

type Prefs = {
  preset: RangePreset;
  customFrom: number | null;
  customTo: number | null;
  hiddenIds: string[];
  refreshMs: number; // 0 = off
  showThresholds: boolean;
  highlight: boolean;
  explorerMetric: string;
};

type AlertRow = { machine: Machine; metric: LiveMetric };
type ChartEvent = { activeLabel?: string | number } | null;

const METRICS: MetricDefinition[] = [
  { key: 'BN_V', label: 'Avg. Voltage (BN)', shortLabel: 'Voltage (BN)', unit: 'V', icon: <Zap className="h-4 w-4" />, color: '#11AFA6' },
  { key: 'R_Current', label: 'Avg. Current (R)', shortLabel: 'Current (R)', unit: 'A', icon: <Activity className="h-4 w-4" />, color: '#E8A12B' },
  { key: 'Temperature', label: 'Avg. Temperature', shortLabel: 'Temperature', unit: '°C', icon: <Thermometer className="h-4 w-4" />, color: '#4F8BD9' },
  { key: 'Vibration', label: 'Avg. Vibration', shortLabel: 'Vibration', unit: 'mm/s', icon: <Waves className="h-4 w-4" />, color: '#18A998' },
  { key: 'Cumulative_Cycles', label: 'Total Cycles', shortLabel: 'Cycles', unit: '', icon: <RotateCw className="h-4 w-4" />, color: '#7B78D2', sum: true },
];

const MACHINE_COLORS = ['#10AFA5', '#E7A12B', '#547FD2', '#DB6F68', '#7B78D2', '#65A55C'];

const HOUR = 3_600_000;
const PRESETS: { key: Exclude<RangePreset, 'custom'>; label: string; ms: number | null }[] = [
  { key: '1h', label: '1h', ms: HOUR },
  { key: '6h', label: '6h', ms: 6 * HOUR },
  { key: '24h', label: '24h', ms: 24 * HOUR },
  { key: '7d', label: '7d', ms: 7 * 24 * HOUR },
  { key: '30d', label: '30d', ms: 30 * 24 * HOUR },
  { key: 'all', label: 'All', ms: null },
];

const REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 10000, label: '10 sec' },
  { value: 30000, label: '30 sec' },
  { value: 60000, label: '1 min' },
  { value: 300000, label: '5 min' },
];

const MIN_ZOOM_SPAN = 60_000; // 1 minute
const PREFS_KEY = 'energy-agent-prefs-v1';

const DEFAULT_PREFS: Prefs = {
  preset: 'all',
  customFrom: null,
  customTo: null,
  hiddenIds: [],
  refreshMs: 30000,
  showThresholds: true,
  highlight: true,
  explorerMetric: 'Temperature',
};

const CARD = 'min-w-0 border border-[#E0E8F1] bg-white p-3.5 shadow-[0_2px_10px_rgba(30,61,93,0.03)]';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable – ignore */
  }
}

function findMetric(machine: Machine, key: string) {
  return machine.liveMetrics.find((metric) => metric.key.toLowerCase() === key.toLowerCase());
}

function aggregate(values: number[], sum = false): number | null {
  if (!values.length) return null;
  const total = values.reduce((result, value) => result + value, 0);
  return sum ? total : total / values.length;
}

function formatValue(value: number | null | undefined, unit: string, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available';
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatTime(value: string | number) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : String(value);
}

function formatTick(timestamp: number, span: number) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return span <= 36 * HOUR
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const pad = (n: number) => String(n).padStart(2, '0');
function toLocalInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function sampleTime(point: { t: string }) {
  return new Date(point.t).getTime();
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const escape = (cell: string | number | null) => {
    const text = cell === null ? '' : String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildTrend(machines: Machine[], key: string, start: number, end: number) {
  const rows = new Map<number, Record<string, number>>();
  machines.forEach((machine) => {
    findMetric(machine, key)?.spark.forEach((point) => {
      const timestamp = sampleTime(point);
      if (!Number.isFinite(timestamp) || !Number.isFinite(point.v)) return;
      if (timestamp < start || timestamp > end) return;
      const row = rows.get(timestamp) ?? { timestamp };
      row[machine.id] = point.v;
      rows.set(timestamp, row);
    });
  });
  return [...rows.values()].sort((first, second) => first.timestamp - second.timestamp);
}

function changeInRange(metrics: (LiveMetric | undefined)[], sum: boolean, start: number, end: number) {
  const starts: number[] = [];
  const ends: number[] = [];
  metrics.forEach((metric) => {
    const samples = [...(metric?.spark ?? [])]
      .filter((point) => Number.isFinite(point.v) && sampleTime(point) >= start && sampleTime(point) <= end)
      .sort((first, second) => sampleTime(first) - sampleTime(second));
    if (samples.length) {
      starts.push(samples[0].v);
      ends.push(samples[samples.length - 1].v);
    }
  });
  const first = aggregate(starts, sum);
  const last = aggregate(ends, sum);
  return first === null || last === null || first === 0 ? null : ((last - first) / Math.abs(first)) * 100;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export const EnergyAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const machines = useMachineStore((state) => state.machines);
  const loading = useMachineStore((state) => state.loading);
  const error = useMachineStore((state) => state.error);
  const loadMachines = useMachineStore((state) => state.loadMachines);

  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const explorerRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((changes: Partial<Prefs>) => setPrefs((previous) => ({ ...previous, ...changes })), []);

  useEffect(() => savePrefs(prefs), [prefs]);

  // Auto refresh (pauses while the tab is hidden)
  useEffect(() => {
    void loadMachines();
    if (!prefs.refreshMs) return undefined;
    const interval = window.setInterval(() => {
      if (!document.hidden) void loadMachines();
    }, prefs.refreshMs);
    return () => window.clearInterval(interval);
  }, [loadMachines, prefs.refreshMs]);

  useEffect(() => {
    if (machines.length) setLastUpdated(Date.now());
  }, [machines]);

  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    machines.forEach((machine, index) => map.set(machine.id, MACHINE_COLORS[index % MACHINE_COLORS.length]));
    return map;
  }, [machines]);

  const visible = useMemo(() => machines.filter((machine) => !prefs.hiddenIds.includes(machine.id)), [machines, prefs.hiddenIds]);

  // Bounds of all available history
  const bounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    machines.forEach((machine) => machine.liveMetrics.forEach((metric) => metric.spark.forEach((point) => {
      const time = sampleTime(point);
      if (!Number.isFinite(time)) return;
      if (time < min) min = time;
      if (time > max) max = time;
    })));
    return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
  }, [machines]);

  // Resolve the active time window
  const range = useMemo(() => {
    if (!bounds) return { start: -Infinity, end: Infinity, invalid: false };
    if (prefs.preset === 'custom') {
      const start = prefs.customFrom ?? bounds.min;
      const end = prefs.customTo ?? bounds.max;
      return start < end ? { start, end, invalid: false } : { start: bounds.min, end: bounds.max, invalid: true };
    }
    const preset = PRESETS.find((item) => item.key === prefs.preset);
    return { start: preset?.ms ? bounds.max - preset.ms : bounds.min, end: bounds.max, invalid: false };
  }, [bounds, prefs.preset, prefs.customFrom, prefs.customTo]);

  const rangeKey = `${range.start}-${range.end}`;

  const alerts: AlertRow[] = useMemo(() => visible.flatMap((machine) => machine.liveMetrics
    .filter((metric) => metric.status === 'warning' || metric.status === 'critical')
    .map((metric) => ({ machine, metric }))), [visible]);

  const energyReadings = useMemo(() => visible.flatMap((machine) => machine.liveMetrics
    .filter((metric) => /kwh|energy/i.test(`${metric.key} ${metric.label} ${metric.unit}`))
    .map((metric) => ({ machine, metric }))), [visible]);

  const statusLabel = error ? 'TELEMETRY UNAVAILABLE' : loading && !machines.length ? 'CONNECTING' : machines.length ? 'LIVE TELEMETRY' : 'NO TELEMETRY';
  const filtersChanged = prefs.preset !== 'all' || prefs.hiddenIds.length > 0;

  const toggleMachine = (id: string) => patch({
    hiddenIds: prefs.hiddenIds.includes(id) ? prefs.hiddenIds.filter((item) => item !== id) : [...prefs.hiddenIds, id],
  });

  const focusMetric = (key: string) => {
    patch({ explorerMetric: key });
    explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const resetFilters = () => patch({ preset: 'all', customFrom: null, customTo: null, hiddenIds: [] });

  return (
    <main className="min-h-screen bg-[#F3F6FA] p-4 md:p-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E5F5F3] text-teal-deep"><Zap className="h-5 w-5" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 font-head text-2xl font-extrabold text-ink">Energy Agent</h1>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${error ? 'bg-rose-100 text-rose-700' : 'bg-[#DDF5EF] text-[#087E72]'}`}>{statusLabel}</span>
              </div>
              <p className="mb-0 mt-1 text-xs text-muted">Analyze your factory&apos;s electrical and machine data for smarter energy decisions.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button type="button" onClick={() => navigate('/agents')} className="inline-flex items-center gap-1.5 border border-border-color bg-white px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Agent portfolio
            </button>
            <button type="button" onClick={() => void loadMachines()} disabled={loading} title="Refresh telemetry" aria-label="Refresh telemetry" className="inline-flex h-9 w-9 items-center justify-center border border-border-color bg-white text-ink hover:border-teal disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {error && <div role="alert" className="flex items-center gap-2 border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0" />Live machine telemetry could not be loaded: {error}</div>}

        {/* Filter toolbar */}
        <section aria-label="Filters" className="sticky top-0 z-20 flex flex-col gap-3 border border-[#E0E8F1] bg-white/95 p-3.5 shadow-[0_2px_10px_rgba(30,61,93,0.05)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted" />
              <div role="group" aria-label="Time range" className="flex overflow-hidden border border-border-color">
                {PRESETS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={prefs.preset === item.key}
                    onClick={() => patch({ preset: item.key })}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold ${prefs.preset === item.key ? 'bg-[#11AFA6] text-white' : 'bg-white text-muted hover:text-ink'}`}
                  >{item.label}</button>
                ))}
                <button
                  type="button"
                  aria-pressed={prefs.preset === 'custom'}
                  onClick={() => patch({ preset: 'custom', customFrom: prefs.customFrom ?? range.start, customTo: prefs.customTo ?? range.end })}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold ${prefs.preset === 'custom' ? 'bg-[#11AFA6] text-white' : 'bg-white text-muted hover:text-ink'}`}
                >Custom</button>
              </div>
            </div>

            {prefs.preset === 'custom' && bounds && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <label className="flex items-center gap-1.5">From
                  <input type="datetime-local" value={toLocalInput(prefs.customFrom ?? bounds.min)} min={toLocalInput(bounds.min)} max={toLocalInput(bounds.max)}
                    onChange={(event) => patch({ customFrom: fromLocalInput(event.target.value) })} className="border border-border-color bg-white px-2 py-1 text-[11px] text-ink" />
                </label>
                <label className="flex items-center gap-1.5">To
                  <input type="datetime-local" value={toLocalInput(prefs.customTo ?? bounds.max)} min={toLocalInput(bounds.min)} max={toLocalInput(bounds.max)}
                    onChange={(event) => patch({ customTo: fromLocalInput(event.target.value) })} className="border border-border-color bg-white px-2 py-1 text-[11px] text-ink" />
                </label>
                {range.invalid && <span role="alert" className="font-semibold text-rose-700">“From” must be earlier than “To”. Showing all data.</span>}
              </div>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted">
                {prefs.refreshMs ? <Play className="h-3.5 w-3.5 text-[#087E72]" /> : <Pause className="h-3.5 w-3.5" />}
                Auto refresh
                <select value={prefs.refreshMs} onChange={(event) => patch({ refreshMs: Number(event.target.value) })} className="border border-border-color bg-white px-1.5 py-1 text-[11px] text-ink">
                  {REFRESH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                <input type="checkbox" checked={prefs.showThresholds} onChange={(event) => patch({ showThresholds: event.target.checked })} className="accent-[#11AFA6]" />
                Show limits
              </label>
              {filtersChanged && (
                <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 border border-border-color bg-white px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-ink">
                  <X className="h-3 w-3" /> Reset filters
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-muted">Devices</span>
            {machines.length === 0 && <span className="text-[11px] text-muted">No devices connected.</span>}
            {machines.map((machine) => {
              const active = !prefs.hiddenIds.includes(machine.id);
              return (
                <button
                  key={machine.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMachine(machine.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? 'border-[#BFE6E1] bg-[#EAF7F6] text-ink' : 'border-border-color bg-white text-muted line-through opacity-70'}`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? colorOf.get(machine.id) : '#B7C2D0' }} />
                  {machine.name}
                </button>
              );
            })}
            {machines.length > 1 && (
              <>
                <button type="button" onClick={() => patch({ hiddenIds: [] })} className="text-[11px] font-semibold text-teal-deep hover:underline">All</button>
                <button type="button" onClick={() => patch({ hiddenIds: machines.slice(1).map((machine) => machine.id) })} className="text-[11px] font-semibold text-teal-deep hover:underline">Only first</button>
              </>
            )}
            {bounds && <span className="ml-auto text-[10px] text-muted">Showing {range.invalid || prefs.preset === 'all' ? 'all history' : `${formatTime(range.start)} – ${formatTime(range.end)}`}</span>}
          </div>
        </section>

        {/* KPI cards */}
        <section aria-label="Latest machine readings" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {METRICS.map((definition) => {
            const readings = visible.map((machine) => findMetric(machine, definition.key));
            const values = readings.map((metric) => metric?.value).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
            const value = aggregate(values, definition.sum);
            const change = changeInRange(readings, Boolean(definition.sum), range.start, range.end);
            const selected = prefs.explorerMetric === definition.key;
            return (
              <button
                key={definition.key}
                type="button"
                onClick={() => focusMetric(definition.key)}
                title="Open in Metric Explorer"
                className={`min-w-0 border bg-white px-3.5 py-3 text-left shadow-[0_2px_10px_rgba(30,61,93,0.03)] transition-colors hover:border-[#11AFA6] ${selected ? 'border-[#11AFA6]' : 'border-[#E0E8F1]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF7F6]" style={{ color: definition.color }}>{definition.icon}</span>
                  <span className="truncate text-[10px] font-medium text-muted">{definition.label}</span>
                </div>
                <div className="mt-2 truncate font-head text-xl font-extrabold text-ink" title={formatValue(value, definition.unit)}>{formatValue(value, definition.unit, definition.sum ? 0 : 2)}</div>
                <div className={`mt-1 text-[10px] ${change === null ? 'text-muted' : change >= 0 ? 'text-[#087E72]' : 'text-rose-700'}`}>
                  {change === null ? 'Change unavailable' : `${change >= 0 ? '▲ +' : '▼ '}${change.toFixed(1)}% vs start of range`}
                </div>
              </button>
            );
          })}
        </section>

        {machines.length > 0 && visible.length === 0 && (
          <div className="border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">All devices are hidden. Select at least one device above to see data.</div>
        )}

        <section className="grid gap-3 xl:grid-cols-12">
          <div className="grid content-start gap-3 md:grid-cols-2 xl:col-span-8">
            <TrendPanel key={`v-${rangeKey}`} title="Voltage Trend" metricKey="BN_V" machines={visible} colorOf={colorOf} start={range.start} end={range.end} showThresholds={prefs.showThresholds} />
            <TrendPanel key={`c-${rangeKey}`} title="Current Trend" metricKey="R_Current" machines={visible} colorOf={colorOf} start={range.start} end={range.end} showThresholds={prefs.showThresholds} />
            <div ref={explorerRef} className="min-w-0 md:col-span-2">
              <TrendPanel key={`e-${rangeKey}`} title="Metric Explorer" metricKey={prefs.explorerMetric} onMetricChange={(key) => patch({ explorerMetric: key })} machines={visible} colorOf={colorOf} start={range.start} end={range.end} showThresholds={prefs.showThresholds} defaultExpanded />
            </div>
            <ComparisonPanel machines={visible} colorOf={colorOf} highlight={prefs.highlight} onHighlightChange={(highlight) => patch({ highlight })} />
            <InsightsPanel machines={visible} energyReadings={energyReadings} />
            <AlertsPanel alerts={alerts} />
          </div>

          <aside className="flex flex-col self-start border border-[#E0E8F1] bg-white xl:col-span-4">
            <div className="flex items-center justify-between border-b border-[#E8EDF3] px-4 py-3">
              <h2 className="m-0 flex items-center gap-2 text-xs font-bold text-ink"><Bell className="h-4 w-4 text-[#5682D0]" /> Telemetry status</h2>
              <span className="text-[10px] text-muted">{prefs.refreshMs ? `Auto refresh: ${REFRESH_OPTIONS.find((option) => option.value === prefs.refreshMs)?.label ?? ''}` : 'Auto refresh: off'}</span>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <StatusRow label="Connected devices" value={`${visible.length} of ${machines.length}`} />
              <StatusRow label="Signals outside limits" value={String(alerts.length)} alert={alerts.length > 0} />
              <StatusRow label="Last updated" value={lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'} />
              <StatusRow label="History from" value={bounds ? formatTime(bounds.min) : '—'} />
              <StatusRow label="History to" value={bounds ? formatTime(bounds.max) : '—'} />
              <div className="flex items-start gap-2 rounded-md bg-[#EFF6FF] p-3 text-[11px] leading-5 text-[#365D8D]">
                <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
                {energyReadings.length
                  ? `${energyReadings.length} energy meter reading${energyReadings.length === 1 ? '' : 's'} available; values are listed in Key Insights.`
                  : 'Energy consumption (kWh) is unavailable: the current telemetry has no energy-meter field.'}
              </div>
              <div className="rounded-md bg-[#F6F8FB] p-3 text-[11px] leading-5 text-muted">
                <strong className="text-ink">Chart tips</strong><br />
                Drag across a chart to zoom into that period. Hold Ctrl/⌘ and scroll to zoom in or out. Use the arrows to pan and the reset button to return.
              </div>
              <button type="button" onClick={() => navigate('/use-cases/15')} className="mt-auto w-fit border-0 bg-transparent p-0 text-left text-[11px] font-bold text-teal-deep hover:underline">
                UC15: Digital Twin &amp; What-If Scenario Analytics
              </button>
            </div>
          </aside>
        </section>
      </div>
      <EnergyAgentChatWidget />
    </main>
  );
};

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                     */
/* -------------------------------------------------------------------------- */

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
      className="inline-flex h-6 w-6 items-center justify-center border border-border-color bg-white text-muted hover:border-teal hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}

function StatusRow({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className="flex items-center justify-between border-b border-[#EEF1F5] pb-3 text-xs"><span className="text-muted">{label}</span><span className={`font-bold ${alert ? 'text-amber-700' : 'text-ink'}`}>{value}</span></div>;
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="flex min-h-[110px] items-center justify-center px-4 text-center text-[10px] text-muted">{text}</div>;
}

/* -------------------------------------------------------------------------- */
/*  Trend panel (zoom, pan, stats, thresholds, CSV)                           */
/* -------------------------------------------------------------------------- */

type TrendPanelProps = {
  title: string;
  metricKey: string;
  machines: Machine[];
  colorOf: Map<string, string>;
  start: number;
  end: number;
  showThresholds: boolean;
  onMetricChange?: (key: string) => void;
  defaultExpanded?: boolean;
};

function TrendPanel({ title, metricKey, machines, colorOf, start, end, showThresholds, onMetricChange, defaultExpanded = false }: TrendPanelProps) {
  const metric = METRICS.find((item) => item.key === metricKey) ?? METRICS[0];
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [dragLeft, setDragLeft] = useState<number | null>(null);
  const [dragRight, setDragRight] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showStats, setShowStats] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const full = useMemo(() => buildTrend(machines, metric.key, start, end), [machines, metric.key, start, end]);
  const extent = useMemo<[number, number] | null>(
    () => (full.length ? [full[0].timestamp, full[full.length - 1].timestamp] : null),
    [full],
  );
  const domain = zoom ?? extent;
  const data = useMemo(() => (zoom ? full.filter((row) => row.timestamp >= zoom[0] && row.timestamp <= zoom[1]) : full), [full, zoom]);
  const withHistory = machines.filter((machine) => (findMetric(machine, metric.key)?.spark.length ?? 0) > 0);
  const span = domain ? domain[1] - domain[0] : 0;

  const clampWindow = useCallback((from: number, to: number): [number, number] | null => {
    if (!extent) return null;
    const width = to - from;
    if (width >= extent[1] - extent[0] - 1) return null; // fully zoomed out
    let a = from;
    let b = to;
    if (a < extent[0]) { a = extent[0]; b = a + width; }
    if (b > extent[1]) { b = extent[1]; a = b - width; }
    return [a, b];
  }, [extent]);

  const applyZoom = useCallback((factor: number, ratio = 0.5) => {
    if (!extent) return;
    setZoom((previous) => {
      const [a, b] = previous ?? extent;
      const current = b - a;
      const next = Math.min(Math.max(current * factor, MIN_ZOOM_SPAN), extent[1] - extent[0]);
      return clampWindow(a + (current - next) * ratio, a + (current - next) * ratio + next);
    });
  }, [extent, clampWindow]);

  const pan = (direction: 1 | -1) => setZoom((previous) => {
    if (!previous) return previous;
    const shift = (previous[1] - previous[0]) * 0.25 * direction;
    return clampWindow(previous[0] + shift, previous[1] + shift) ?? previous;
  });

  // Ctrl/⌘ + wheel zoom (needs a non-passive listener to block page zoom)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const handler = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      applyZoom(event.deltaY < 0 ? 0.7 : 1.4, ratio);
    };
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, [applyZoom]);

  const onDown = (event: ChartEvent) => { if (event?.activeLabel !== undefined) setDragLeft(Number(event.activeLabel)); };
  const onMove = (event: ChartEvent) => { if (dragLeft !== null && event?.activeLabel !== undefined) setDragRight(Number(event.activeLabel)); };
  const onUp = () => {
    if (dragLeft !== null && dragRight !== null && dragLeft !== dragRight) {
      setZoom(clampWindow(Math.min(dragLeft, dragRight), Math.max(dragLeft, dragRight)));
    }
    setDragLeft(null);
    setDragRight(null);
  };

  const thresholds = useMemo(() => {
    if (!showThresholds) return [] as { value: number; kind: 'warning' | 'critical' }[];
    const seen = new Set<string>();
    const lines: { value: number; kind: 'warning' | 'critical' }[] = [];
    machines.forEach((machine) => {
      const reading = findMetric(machine, metric.key);
      if (!reading) return;
      (['warning', 'critical'] as const).forEach((kind) => {
        const value = kind === 'warning' ? reading.warningThreshold : reading.criticalThreshold;
        if (typeof value !== 'number' || !Number.isFinite(value) || seen.has(`${kind}-${value}`)) return;
        seen.add(`${kind}-${value}`);
        lines.push({ value, kind });
      });
    });
    return lines;
  }, [machines, metric.key, showThresholds]);

  const stats = useMemo(() => withHistory.map((machine) => {
    const values = data.map((row) => row[machine.id]).filter((value): value is number => typeof value === 'number');
    return {
      machine,
      count: values.length,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      avg: aggregate(values),
    };
  }), [withHistory, data]);

  const exportCsv = () => downloadCsv(
    `${metric.key}-trend.csv`,
    [['Timestamp', ...withHistory.map((machine) => `${machine.name} (${metric.unit || 'value'})`)],
      ...data.map((row) => [new Date(row.timestamp).toISOString(), ...withHistory.map((machine) => row[machine.id] ?? null)])],
  );

  return (
    <section className={`${CARD} ${expanded ? 'md:col-span-2' : ''}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="m-0 truncate text-xs font-bold text-ink">{title}</h2>
          {onMetricChange && (
            <select aria-label="Metric" value={metric.key} onChange={(event) => onMetricChange(event.target.value)} className="border border-border-color bg-white px-1.5 py-1 text-[11px] text-ink">
              {METRICS.map((item) => <option key={item.key} value={item.key}>{item.shortLabel}{item.unit ? ` (${item.unit})` : ''}</option>)}
            </select>
          )}
          {zoom && <span className="shrink-0 rounded-full bg-[#EAF7F6] px-2 py-0.5 text-[10px] font-semibold text-[#087E72]">Zoomed</span>}
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Pan left" onClick={() => pan(-1)} disabled={!zoom}><ChevronLeft className="h-3.5 w-3.5" /></IconButton>
          <IconButton label="Pan right" onClick={() => pan(1)} disabled={!zoom}><ChevronRight className="h-3.5 w-3.5" /></IconButton>
          <IconButton label="Zoom in" onClick={() => applyZoom(0.5)} disabled={!extent || span <= MIN_ZOOM_SPAN}><ZoomIn className="h-3.5 w-3.5" /></IconButton>
          <IconButton label="Zoom out" onClick={() => applyZoom(2)} disabled={!zoom}><ZoomOut className="h-3.5 w-3.5" /></IconButton>
          <IconButton label="Reset zoom" onClick={() => setZoom(null)} disabled={!zoom}><RotateCcw className="h-3.5 w-3.5" /></IconButton>
          <IconButton label="Download CSV" onClick={exportCsv} disabled={!data.length}><Download className="h-3.5 w-3.5" /></IconButton>
          <IconButton label={expanded ? 'Collapse chart' : 'Expand chart'} onClick={() => setExpanded((value) => !value)}>
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </IconButton>
        </div>
      </div>

      <div ref={containerRef} className={`w-full select-none ${expanded ? 'h-[340px]' : 'h-[190px]'}`}>
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: -14, bottom: 0 }} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
              <CartesianGrid stroke="#E9EEF4" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={domain ?? ['dataMin', 'dataMax']}
                allowDataOverflow
                tickFormatter={(value) => formatTick(Number(value), span)}
                tick={{ fontSize: 9, fill: '#8290A3' }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis tick={{ fontSize: 9, fill: '#8290A3' }} tickLine={false} axisLine={false} width={46} domain={['auto', 'auto']} />
              <Tooltip
                labelFormatter={(value) => formatTime(Number(value))}
                formatter={(value, name) => [formatValue(Number(value), metric.unit, 3), String(name)]}
              />
              {withHistory.length > 1 && <Legend wrapperStyle={{ fontSize: 9 }} />}
              {thresholds.map((line) => (
                <ReferenceLine key={`${line.kind}-${line.value}`} y={line.value} ifOverflow="extendDomain" stroke={line.kind === 'critical' ? '#DC2626' : '#D97706'} strokeDasharray="5 4"
                  label={{ value: `${line.kind} ${line.value}`, fontSize: 9, fill: line.kind === 'critical' ? '#DC2626' : '#D97706', position: 'insideTopRight' }} />
              ))}
              {withHistory.map((machine) => (
                <Line key={machine.id} type="monotone" dataKey={machine.id} name={machine.name} stroke={colorOf.get(machine.id) ?? metric.color} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} connectNulls isAnimationActive={false} />
              ))}
              {dragLeft !== null && dragRight !== null && <ReferenceArea x1={dragLeft} x2={dragRight} fill="#11AFA6" fillOpacity={0.15} stroke="#11AFA6" strokeOpacity={0.4} />}
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyPanel text={machines.length ? 'No timestamped history is available for this signal in the selected time range.' : 'No devices selected.'} />}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
        <span>{data.length ? `${data.length} sample${data.length === 1 ? '' : 's'} · drag to zoom · Ctrl/⌘ + scroll` : ' '}</span>
        {data.length > 0 && <button type="button" onClick={() => setShowStats((value) => !value)} className="border-0 bg-transparent p-0 font-semibold text-teal-deep hover:underline">{showStats ? 'Hide statistics' : 'Show statistics'}</button>}
      </div>

      {showStats && stats.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-left text-[10px]">
            <thead className="bg-[#F3F7FB] text-muted"><tr><th className="px-2 py-1.5 font-semibold">Device</th><th className="px-2 py-1.5 font-semibold">Min</th><th className="px-2 py-1.5 font-semibold">Avg</th><th className="px-2 py-1.5 font-semibold">Max</th></tr></thead>
            <tbody>{stats.map(({ machine, min, avg, max }) => (
              <tr key={machine.id} className="border-b border-[#EDF1F5] last:border-0">
                <td className="px-2 py-1.5 font-medium text-ink"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOf.get(machine.id) }} />{machine.name}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted">{formatValue(min, metric.unit)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted">{formatValue(avg, metric.unit)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted">{formatValue(max, metric.unit)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Device comparison                                                         */
/* -------------------------------------------------------------------------- */

function ComparisonPanel({ machines, colorOf, highlight, onHighlightChange }: { machines: Machine[]; colorOf: Map<string, string>; highlight: boolean; onHighlightChange: (value: boolean) => void }) {
  const exportCsv = () => downloadCsv('device-comparison.csv', [
    ['Parameter', ...machines.map((machine) => machine.name)],
    ...METRICS.map((definition) => [`${definition.shortLabel}${definition.unit ? ` (${definition.unit})` : ''}`, ...machines.map((machine) => findMetric(machine, definition.key)?.value ?? null)]),
  ]);

  return (
    <section className={CARD}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-bold text-ink">Device Comparison</h2>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 text-[10px] text-muted">
            <input type="checkbox" checked={highlight} onChange={(event) => onHighlightChange(event.target.checked)} className="accent-[#11AFA6]" /> Highlight high/low
          </label>
          <IconButton label="Download CSV" onClick={exportCsv} disabled={!machines.length}><Download className="h-3.5 w-3.5" /></IconButton>
        </div>
      </div>
      {machines.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[430px] border-collapse text-left text-[10px]">
            <thead className="bg-[#F3F7FB] text-muted"><tr><th className="px-2 py-2 font-semibold">Parameter</th>{machines.map((machine) => (
              <th key={machine.id} className="max-w-[100px] truncate px-2 py-2 font-semibold" title={machine.name}>
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: colorOf.get(machine.id) }} />{machine.name}
              </th>
            ))}</tr></thead>
            <tbody>{METRICS.map((definition) => {
              const values = machines.map((machine) => findMetric(machine, definition.key)?.value);
              const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
              const high = numeric.length ? Math.max(...numeric) : null;
              const low = numeric.length ? Math.min(...numeric) : null;
              const canHighlight = highlight && machines.length > 1 && high !== low;
              return (
                <tr key={definition.key} className="border-b border-[#EDF1F5] last:border-0">
                  <td className="whitespace-nowrap px-2 py-2 text-muted">{definition.shortLabel}</td>
                  {machines.map((machine, index) => {
                    const value = values[index];
                    const tone = canHighlight && typeof value === 'number' ? (value === high ? 'bg-amber-50 text-amber-800' : value === low ? 'bg-[#E8F7F5] text-[#087E72]' : '') : '';
                    return <td key={machine.id} className={`whitespace-nowrap px-2 py-2 font-medium text-ink ${tone}`}>{formatValue(value, definition.unit, definition.sum ? 0 : 2)}</td>;
                  })}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : <EmptyPanel text="No machine readings are available." />}
      {highlight && machines.length > 1 && <p className="mb-0 mt-2 text-[9px] text-muted">Amber = highest value in the row, teal = lowest.</p>}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Key insights                                                              */
/* -------------------------------------------------------------------------- */

function InsightsPanel({ machines, energyReadings }: { machines: Machine[]; energyReadings: AlertRow[] }) {
  return (
    <section className={CARD}>
      <h2 className="mb-3 mt-0 flex items-center gap-2 text-xs font-bold text-ink"><Activity className="h-4 w-4 text-[#6683D8]" /> Key Insights</h2>
      <div className="flex flex-col gap-3">
        {METRICS.slice(0, 4).map((definition) => {
          const readings = machines.map((machine) => findMetric(machine, definition.key)).filter((metric): metric is LiveMetric => Boolean(metric && metric.value !== null));
          const warning = readings.filter((metric) => metric.status === 'warning').length;
          const critical = readings.filter((metric) => metric.status === 'critical').length;
          const mean = aggregate(readings.map((metric) => metric.value).filter((value): value is number => value !== null));
          const outOfRange = warning + critical > 0;
          const thresholdsConfigured = readings.length > 0 && readings.every((metric) => metric.warningThreshold !== null || metric.criticalThreshold !== null);
          return (
            <div key={definition.key} className="flex items-start gap-2">
              {outOfRange ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10AFA5]" />}
              <div>
                <div className="text-[10px] font-semibold text-[#40516B]">{outOfRange ? `${definition.shortLabel}: ${warning} warning, ${critical} critical.` : thresholdsConfigured ? `${definition.shortLabel} readings are within configured limits.` : `${definition.shortLabel}: no configured threshold alert.`}</div>
                <div className="mt-0.5 text-[9px] leading-4 text-muted">{readings.length ? `Mean of ${readings.length} device${readings.length === 1 ? '' : 's'}: ${formatValue(mean, definition.unit)}.` : 'No readings available for this signal.'}</div>
              </div>
            </div>
          );
        })}
        <div className="flex items-start gap-2 border-t border-[#EDF1F5] pt-2">
          <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3B82C4]" />
          <div>
            <div className="text-[10px] font-semibold text-[#40516B]">Energy consumption (kWh)</div>
            <div className="mt-0.5 text-[9px] leading-4 text-muted">{energyReadings.length ? energyReadings.map(({ machine, metric }) => `${machine.name}: ${formatValue(metric.value, metric.unit)}`).join('; ') : 'Not available: no energy meter reading is present in live telemetry.'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Alerts (search, severity filter, sorting, export)                         */
/* -------------------------------------------------------------------------- */

type SortKey = 'time' | 'device' | 'signal' | 'reading' | 'status';

function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  const [severity, setSeverity] = useState<'all' | 'warning' | 'critical'>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDesc, setSortDesc] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const PAGE = 8;

  const lastTime = (row: AlertRow) => {
    const point = row.metric.spark[row.metric.spark.length - 1];
    return point ? sampleTime(point) : 0;
  };

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = alerts.filter(({ machine, metric }) => (severity === 'all' || metric.status === severity)
      && (!needle || `${machine.name} ${metric.label} ${metric.key}`.toLowerCase().includes(needle)));
    const compare = (a: AlertRow, b: AlertRow) => {
      switch (sortKey) {
        case 'device': return a.machine.name.localeCompare(b.machine.name);
        case 'signal': return (a.metric.label || a.metric.key).localeCompare(b.metric.label || b.metric.key);
        case 'reading': return (a.metric.value ?? 0) - (b.metric.value ?? 0);
        case 'status': return a.metric.status.localeCompare(b.metric.status);
        default: return lastTime(a) - lastTime(b);
      }
    };
    return [...filtered].sort((a, b) => (sortDesc ? -compare(a, b) : compare(a, b)));
  }, [alerts, severity, query, sortKey, sortDesc]);

  const shown = showAll ? rows : rows.slice(0, PAGE);
  const critical = alerts.filter(({ metric }) => metric.status === 'critical').length;

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc((value) => !value);
    else { setSortKey(key); setSortDesc(key === 'time'); }
  };
  const header = (key: SortKey, label: string) => (
    <th className="px-2 py-2 font-semibold" aria-sort={sortKey === key ? (sortDesc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-semibold text-muted hover:text-ink">
        {label}{sortKey === key ? (sortDesc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );

  const exportCsv = () => downloadCsv('alerts.csv', [
    ['Last sample', 'Device', 'Signal', 'Reading', 'Unit', 'Status'],
    ...rows.map((row) => [lastTime(row) ? new Date(lastTime(row)).toISOString() : '', row.machine.name, row.metric.label || row.metric.key, row.metric.value, row.metric.unit, row.metric.status]),
  ]);

  return (
    <section className={`${CARD} md:col-span-2`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 flex items-center gap-2 text-xs font-bold text-ink"><Bell className="h-4 w-4 text-[#6683D8]" /> Recent Alerts
          <span className="font-normal text-muted">({alerts.length} active signal{alerts.length === 1 ? '' : 's'}{critical ? `, ${critical} critical` : ''})</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search device or signal" aria-label="Search alerts" className="w-44 border border-border-color bg-white py-1 pl-6 pr-2 text-[11px] text-ink" />
          </div>
          <div role="group" aria-label="Severity" className="flex overflow-hidden border border-border-color">
            {(['all', 'warning', 'critical'] as const).map((item) => (
              <button key={item} type="button" aria-pressed={severity === item} onClick={() => setSeverity(item)} className={`px-2 py-1 text-[11px] font-semibold capitalize ${severity === item ? 'bg-[#11AFA6] text-white' : 'bg-white text-muted hover:text-ink'}`}>{item}</button>
            ))}
          </div>
          <IconButton label="Download CSV" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" /></IconButton>
        </div>
      </div>

      {rows.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[10px]">
              <thead className="bg-[#F3F7FB] text-muted"><tr>{header('time', 'Last sample')}{header('device', 'Device')}{header('signal', 'Signal')}{header('reading', 'Reading')}{header('status', 'Status')}</tr></thead>
              <tbody>{shown.map((row) => {
                const timestamp = lastTime(row);
                return (
                  <tr key={`${row.machine.id}-${row.metric.key}`} className="border-b border-[#EDF1F5] last:border-0">
                    <td className="whitespace-nowrap px-2 py-2 text-muted">{timestamp ? formatTime(timestamp) : 'Timestamp unavailable'}</td>
                    <td className="px-2 py-2 font-medium text-ink">{row.machine.name}</td>
                    <td className="px-2 py-2 text-muted">{row.metric.label || row.metric.key}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-ink">{formatValue(row.metric.value, row.metric.unit)}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 font-bold capitalize ${row.metric.status === 'critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{row.metric.status}</span></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          {rows.length > PAGE && (
            <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-2 border-0 bg-transparent p-0 text-[11px] font-bold text-teal-deep hover:underline">
              {showAll ? 'Show fewer' : `Show all ${rows.length} alerts`}
            </button>
          )}
        </>
      ) : <EmptyPanel text={alerts.length ? 'No alerts match the current search or severity filter.' : 'No signals are currently beyond their configured limits.'} />}
    </section>
  );
}