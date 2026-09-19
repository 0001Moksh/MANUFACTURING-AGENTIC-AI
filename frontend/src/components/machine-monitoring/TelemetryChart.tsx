import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import type { LiveMetric } from '../../data/machineMonitoringData';

interface TelemetryChartProps {
  signals: LiveMetric[];
  selectedKeys: string[];
  onToggleSignal: (key: string) => void;
  maxSelected?: number;
}

type RangeKey = '1h' | '6h' | '24h' | '7d';
type ScaleMode = 'auto' | 'actual' | 'percent';
type Series = { key: string; label: string; unit: string; color: string; warning: number | null; critical: number | null; range: [number, number] | null; denominator: number; latest: number | null };
type Row = { timestamp: number; [key: string]: number };

const RANGE_MS: Record<RangeKey, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };
const PALETTE = ['#0D9488', '#2563EB', '#D97706', '#9333EA', '#DC2626', '#059669', '#DB2777', '#475569'];
const STATUS_HEX = { critical: '#DC2626', warning: '#D97706', normal: '#059669' } as const;
const STATUS_PILL = { critical: 'bg-red-50 text-red-700 border-red-200', warning: 'bg-amber-50 text-amber-700 border-amber-200', normal: 'bg-emerald-50 text-emerald-700 border-emerald-200' } as const;

const formatTick = (value: number | string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const numberOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const safeId = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, '_');
const statusOf = (value: number | null, warning: number | null, critical: number | null) => value !== null && critical !== null && value > critical ? 'critical' : value !== null && warning !== null && value > warning ? 'warning' : 'normal';

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ signals, selectedKeys, onToggleSignal, maxSelected = 8 }) => {
  const [timeRange, setTimeRange] = useState<RangeKey>('1h');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('auto');

  const series = useMemo<Series[]>(() => selectedKeys.flatMap((key) => {
    const index = signals.findIndex((signal) => signal.key === key);
    if (index < 0) return [];
    const signal = signals[index];
    const points = signal.spark.map((point) => ({ t: typeof point.t === 'number' ? point.t : new Date(point.t).getTime(), v: Number(point.v) })).filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v));
    const warning = numberOrNull(signal.warningThreshold);
    const critical = numberOrNull(signal.criticalThreshold);
    const max = points.length ? Math.max(...points.map((point) => point.v)) : 0;
    return [{ key, label: signal.label || key, unit: signal.unit || '', color: PALETTE[index % PALETTE.length], warning, critical, range: Array.isArray(signal.normalRange) && signal.normalRange.length > 1 ? [Number(signal.normalRange[0]), Number(signal.normalRange[1])] : null, denominator: critical ?? warning ?? (max || 1), latest: numberOrNull(signal.value) ?? (points.length ? points[points.length - 1].v : null) }];
  }), [signals, selectedKeys]);

  const isMulti = series.length > 1;
  const unitsDiffer = new Set(series.map((item) => item.unit)).size > 1;
  const percentMode = isMulti && (scaleMode === 'percent' || (scaleMode === 'auto' && unitsDiffer));

  const data = useMemo<Row[]>(() => {
    const points = selectedKeys.flatMap((key) => {
      const signal = signals.find((item) => item.key === key);
      return signal?.spark.map((point) => ({ key, t: typeof point.t === 'number' ? point.t : new Date(point.t).getTime(), v: Number(point.v) })) ?? [];
    }).filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v));
    if (!points.length) return [];
    const cutoff = Math.max(...points.map((point) => point.t)) - RANGE_MS[timeRange];
    const rows = new Map<number, Row>();
    points.forEach((point) => {
      if (point.t < cutoff) return;
      const timestamp = Math.round(point.t / 1000) * 1000;
      const row = rows.get(timestamp) ?? { timestamp };
      const info = series.find((item) => item.key === point.key);
      row[point.key] = percentMode ? (point.v / (info?.denominator ?? 1)) * 100 : point.v;
      row[`${point.key}__raw`] = point.v;
      rows.set(timestamp, row);
    });
    return [...rows.values()].sort((left, right) => left.timestamp - right.timestamp);
  }, [signals, selectedKeys, series, timeRange, percentMode]);

  const single = series.length === 1 ? series[0] : null;
  const dataMax = data.length ? Math.max(0, ...data.flatMap((row) => series.map((item) => typeof row[item.key] === 'number' ? row[item.key] : 0))) : 0;
  const yMax = percentMode ? Math.max(120, Math.ceil(dataMax * 1.05)) : single?.critical !== null && single?.critical !== undefined ? Math.min(Math.max(single.critical * 1.15, dataMax * 1.08), single.critical * 1.6) : dataMax > 0 ? dataMax * 1.1 : 1;
  const singleStatus = single ? statusOf(single.latest, single.warning, single.critical) : 'normal';
  const lineColor = (item: Series) => single ? STATUS_HEX[singleStatus] : item.color;

  return <div className="overflow-hidden rounded-[18px] border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
    <div className="border-b border-slate-100 px-5 pb-3 pt-4"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0">{single ? <><div className="flex flex-wrap items-center gap-2.5"><h4 className="font-head text-[16px] font-bold tracking-tight text-slate-800">{single.label}</h4><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_PILL[singleStatus]}`}><span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_HEX[singleStatus] }} />{singleStatus}</span></div><div className="mt-1.5 flex items-baseline gap-2"><span className="font-mono text-[22px] font-bold" style={{ color: STATUS_HEX[singleStatus] }}>{single.latest ?? 'N/A'}</span><span className="text-sm text-slate-400">{single.unit}</span></div><p className="mt-1.5 text-[11.5px] text-slate-500">{single.range ? `Normal ${single.range[0]}-${single.range[1]} ${single.unit}` : 'No normal range configured'}{single.warning !== null && <> <span className="mx-1.5 text-slate-300">·</span>Warn &gt; {single.warning}</>}{single.critical !== null && <> <span className="mx-1.5 text-slate-300">·</span>Crit &gt; {single.critical}</>}</p></> : <><h4 className="font-head text-[16px] font-bold tracking-tight text-slate-800">Comparing {series.length} signals</h4><div className="mt-2 flex flex-wrap gap-1.5">{series.map((item) => { const status = statusOf(item.latest, item.warning, item.critical); return <span key={item.key} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}<b style={{ color: STATUS_HEX[status] }}>{item.latest ?? 'N/A'} {item.unit}</b></span>; })}</div>{percentMode && <p className="mt-2 text-[11px] text-slate-500">Showing % of critical limit. 100% equals the critical threshold.</p>}</>}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5"><span className="hidden items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-700 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />INFLUXDB</span>{isMulti && <div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 text-[12px]">{(['auto', 'actual', 'percent'] as const).map((mode) => <button key={mode} onClick={() => setScaleMode(mode)} className={`rounded-lg px-3 py-1.5 ${scaleMode === mode ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500'}`}>{mode === 'percent' ? '% of limit' : mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>}<div className="flex items-center rounded-xl border border-slate-200/80 bg-slate-100/80 p-0.5 text-[12px]">{(['1h', '6h', '24h', '7d'] as const).map((range) => <button key={range} onClick={() => setTimeRange(range)} className={`rounded-lg px-3 py-1.5 ${timeRange === range ? 'bg-white font-bold text-slate-800 shadow-sm' : 'text-slate-500'}`}>{range}</button>)}</div></div>
    </div></div>
    <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r"><div className="mb-3 flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700">Signal list</span><span className="text-[10px] font-semibold text-slate-400">{selectedKeys.length}/{maxSelected}</span></div><div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto pr-1">{signals.map((signal, index) => { const selected = selectedKeys.includes(signal.key); const disabled = !selected && selectedKeys.length >= maxSelected; const color = PALETTE[index % PALETTE.length]; return <button key={signal.key} type="button" disabled={disabled} onClick={() => onToggleSignal(signal.key)} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] ${selected ? 'bg-slate-100 font-bold text-slate-800' : 'text-slate-600 hover:bg-slate-50'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}><span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] text-white" style={selected ? { background: color, borderColor: color } : { background: '#fff', borderColor: '#cbd5e1' }}>{selected ? '✓' : ''}</span><span className="truncate">{signal.label} ({signal.unit})</span></button>; })}</div></aside>
      <div className="px-2 pb-4 pt-3 sm:px-4">{!series.length || !data.length ? <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">{!series.length ? 'Select at least one signal to plot.' : 'No samples in this time range.'}</div> : <div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 16, left: -8, bottom: 4 }}><defs>{series.map((item) => <linearGradient key={item.key} id={`grad-${safeId(item.key)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={lineColor(item)} stopOpacity={single ? 0.22 : 0.12} /><stop offset="95%" stopColor={lineColor(item)} stopOpacity={0.02} /></linearGradient>)}</defs>{single && !percentMode && single.range && single.warning !== null && <><ReferenceArea y1={0} y2={single.range[1]} fill="#059669" fillOpacity={0.05} /><ReferenceArea y1={single.range[1]} y2={single.warning} fill="#D97706" fillOpacity={0.06} /><ReferenceArea y1={single.warning} y2={yMax} fill="#DC2626" fillOpacity={0.07} /></>}<CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="timestamp" tickFormatter={formatTick} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} minTickGap={40} /><YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} domain={[0, yMax]} width={46} tickFormatter={(value: number) => percentMode ? `${Math.round(value)}%` : String(Math.round(value * 10) / 10)} /><Tooltip content={({ active, payload, label }) => { if (!active || !payload?.length) return null; const row = payload[0].payload as Row; return <div className="min-w-[180px] rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-2.5 text-xs text-slate-800 shadow-xl"><div className="mb-1.5 text-slate-400">{formatTick(label as number)}</div>{series.map((item) => { const raw = row[`${item.key}__raw`]; if (typeof raw !== 'number') return null; const status = statusOf(raw, item.warning, item.critical); return <div key={item.key} className="flex items-center justify-between gap-5"><span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: lineColor(item) }} />{item.label}</span><span className="font-mono font-bold" style={{ color: STATUS_HEX[status] }}>{Math.round(raw * 100) / 100} {item.unit}</span></div>; })}</div>; }} />{single && !percentMode && single.warning !== null && <ReferenceLine y={single.warning} stroke="#D97706" strokeDasharray="5 4" label={{ value: `Warn ${single.warning}`, fill: '#D97706', fontSize: 10, position: 'insideTopRight' }} />}{single && !percentMode && single.critical !== null && <ReferenceLine y={single.critical} stroke="#DC2626" strokeDasharray="5 4" label={{ value: `Crit ${single.critical}`, fill: '#DC2626', fontSize: 10, position: 'insideTopRight' }} />}{percentMode && <ReferenceLine y={100} stroke="#DC2626" strokeDasharray="5 4" label={{ value: 'Critical limit (100%)', fill: '#DC2626', fontSize: 10, position: 'insideTopRight' }} />}{series.map((item) => <Area key={item.key} type="monotone" dataKey={item.key} stroke={lineColor(item)} strokeWidth={single ? 2.5 : 2} fill={`url(#grad-${safeId(item.key)})`} dot={false} connectNulls activeDot={{ r: 5, fill: lineColor(item), stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false} />)}</AreaChart></ResponsiveContainer></div>}</div>
    </div>
  </div>;
};
