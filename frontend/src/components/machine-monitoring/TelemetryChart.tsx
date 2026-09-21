import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Brush,
} from 'recharts';
import type { LiveMetric } from '../../data/machineMonitoringData';

interface TelemetryChartProps {
  signals: LiveMetric[];
  selectedKeys: string[];
  onToggleSignal: (key: string) => void;
  maxSelected?: number;
}

type RangeKey = '1h' | '6h' | '24h' | '7d';
type ScaleMode = 'auto' | 'actual' | 'percent';
type Series = {
  key: string;
  label: string;
  unit: string;
  color: string;
  warning: number | null;
  critical: number | null;
  range: [number, number] | null;
  denominator: number;
  latest: number | null;
};
type Row = { timestamp: number; [key: string]: number };

const RANGE_MS: Record<RangeKey, number> = {
  '1h': 3600000,
  '6h': 21600000,
  '24h': 86400000,
  '7d': 604800000,
};

const PALETTE = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#f472b6', // pink
  '#34d399', // emerald
  '#60a5fa', // blue
  '#fb7185', // rose
  '#c084fc', // purple
];

const STATUS_HEX = {
  critical: '#f87171',
  warning: '#fbbf24',
  normal: '#34d399',
} as const;

const STATUS_PILL = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/40 shadow-[0_0_12px_rgba(248,113,113,0.25)]',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]',
  normal: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(52,211,153,0.25)]',
} as const;

const formatTick = (value: number | string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const safeId = (key: string) => key.replace(/[^a-zA-Z0-9_-]/g, '_');

const statusOf = (
  value: number | null,
  warning: number | null,
  critical: number | null
): 'critical' | 'warning' | 'normal' => {
  if (value !== null && critical !== null && value > critical) return 'critical';
  if (value !== null && warning !== null && value > warning) return 'warning';
  return 'normal';
};

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  signals,
  selectedKeys,
  onToggleSignal,
  maxSelected = 8,
}) => {
  const [timeRange, setTimeRange] = useState<RangeKey>('1h');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('auto');

  const series = useMemo<Series[]>(() => {
    return selectedKeys.flatMap((key) => {
      const index = signals.findIndex((s) => s.key === key);
      if (index < 0) return [];
      const signal = signals[index];
      const points = signal.spark
        .map((p) => ({
          t: typeof p.t === 'number' ? p.t : new Date(p.t).getTime(),
          v: Number(p.v),
        }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));

      const warning = numberOrNull(signal.warningThreshold);
      const critical = numberOrNull(signal.criticalThreshold);
      const max = points.length ? Math.max(...points.map((p) => p.v)) : 0;

      return [
        {
          key,
          label: signal.label || key,
          unit: signal.unit || '',
          color: PALETTE[index % PALETTE.length],
          warning,
          critical,
          range:
            Array.isArray(signal.normalRange) && signal.normalRange.length > 1
              ? [Number(signal.normalRange[0]), Number(signal.normalRange[1])]
              : null,
          denominator: critical ?? warning ?? (max || 1),
          latest: numberOrNull(signal.value) ?? (points.length ? points[points.length - 1].v : null),
        },
      ];
    });
  }, [signals, selectedKeys]);

  const isMulti = series.length > 1;
  const unitsDiffer = new Set(series.map((s) => s.unit)).size > 1;
  const percentMode = isMulti && (scaleMode === 'percent' || (scaleMode === 'auto' && unitsDiffer));

  const data = useMemo<Row[]>(() => {
    const points = selectedKeys.flatMap((key) => {
      const signal = signals.find((s) => s.key === key);
      return (
        signal?.spark.map((p) => ({
          key,
          t: typeof p.t === 'number' ? p.t : new Date(p.t).getTime(),
          v: Number(p.v),
        })) ?? []
      );
    }).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));

    if (!points.length) return [];

    const cutoff = Math.max(...points.map((p) => p.t)) - RANGE_MS[timeRange];
    const rows = new Map<number, Row>();

    points.forEach((point) => {
      if (point.t < cutoff) return;
      const timestamp = Math.round(point.t / 1000) * 1000;
      const row = rows.get(timestamp) ?? { timestamp };
      const info = series.find((s) => s.key === point.key);
      row[point.key] = percentMode ? (point.v / (info?.denominator ?? 1)) * 100 : point.v;
      row[`${point.key}__raw`] = point.v;
      rows.set(timestamp, row);
    });

    return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
  }, [signals, selectedKeys, series, timeRange, percentMode]);

  const single = series.length === 1 ? series[0] : null;
  const dataMax = data.length
    ? Math.max(0, ...data.flatMap((row) => series.map((s) => (typeof row[s.key] === 'number' ? row[s.key] : 0))))
    : 0;

  const yMax = percentMode
    ? Math.max(120, Math.ceil(dataMax * 1.08))
    : single?.critical != null
      ? Math.min(Math.max(single.critical * 1.18, dataMax * 1.1), single.critical * 1.7)
      : dataMax > 0
        ? dataMax * 1.12
        : 1;

  const singleStatus = single ? statusOf(single.latest, single.warning, single.critical) : 'normal';
  const lineColor = (item: Series) => (single ? STATUS_HEX[singleStatus] : item.color);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-[0_0_40px_-12px_rgba(34,211,238,0.15)]">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/40 px-5 pb-4 pt-5 backdrop-blur-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          {/* Left: Title + Status */}
          <div className="min-w-0">
            {single ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h4 className="font-head text-[17px] font-bold tracking-tight text-slate-100">
                    {single.label}
                  </h4>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${STATUS_PILL[singleStatus]}`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{ background: STATUS_HEX[singleStatus] }}
                    />
                    {singleStatus}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-2.5">
                  <span
                    className="font-mono text-[28px] font-bold tracking-tight"
                    style={{
                      color: STATUS_HEX[singleStatus],
                      textShadow: `0 0 20px ${STATUS_HEX[singleStatus]}40`,
                    }}
                  >
                    {single.latest ?? 'N/A'}
                  </span>
                  <span className="text-sm font-medium text-slate-400">{single.unit}</span>
                </div>

                <p className="mt-2 text-[12px] text-slate-400">
                  {single.range ? (
                    <>
                      Normal <span className="text-emerald-400/90">{single.range[0]}–{single.range[1]}</span>{' '}
                      {single.unit}
                    </>
                  ) : (
                    'No normal range configured'
                  )}
                  {single.warning !== null && (
                    <>
                      <span className="mx-2 text-slate-600">·</span>
                      Warn &gt; <span className="text-amber-400">{single.warning}</span>
                    </>
                  )}
                  {single.critical !== null && (
                    <>
                      <span className="mx-2 text-slate-600">·</span>
                      Crit &gt; <span className="text-red-400">{single.critical}</span>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <h4 className="font-head text-[17px] font-bold tracking-tight text-slate-100">
                  Comparing {series.length} signals
                </h4>
               
              </>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            

            {isMulti && (
              <div className="flex items-center rounded-xl border border-slate-600/50 bg-slate-800/50 p-0.5 text-[12px]">
                {(['auto', 'actual', 'percent'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setScaleMode(mode)}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      scaleMode === mode
                        ? 'bg-slate-700 font-bold text-cyan-300 shadow-inner'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'percent' ? '% of limit' : mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center rounded-xl border border-slate-600/50 bg-slate-800/50 p-0.5 text-[12px]">
              {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    timeRange === range
                      ? 'bg-slate-700 font-bold text-cyan-300 shadow-inner'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Signal List */}
        <aside className="border-b border-slate-700/50 bg-slate-900/30 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
              Signal list
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              {selectedKeys.length}/{maxSelected}
            </span>
          </div>

          <div className="flex max-h-[340px] flex-col gap-1.5 overflow-y-auto pr-1">
            {signals.map((signal, index) => {
              const selected = selectedKeys.includes(signal.key);
              const disabled = !selected && selectedKeys.length >= maxSelected;
              const color = PALETTE[index % PALETTE.length];

              return (
                <button
                  key={signal.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleSignal(signal.key)}
                  className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12px] transition-all ${
                    selected
                      ? 'bg-slate-800/80 font-semibold text-slate-100 ring-1 ring-cyan-500/30'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  } ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold text-white transition-all"
                    style={
                      selected
                        ? {
                            background: color,
                            borderColor: color,
                            boxShadow: `0 0 10px ${color}60`,
                          }
                        : { background: 'transparent', borderColor: '#475569' }
                    }
                  >
                    {selected ? '✓' : ''}
                  </span>
                  <span className="truncate">{signal.label}</span>
                  <span className="ml-auto text-[10px] text-slate-500 group-hover:text-slate-400">
                    {signal.unit}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chart */}
        <div className="px-2 pb-5 pt-4 sm:px-5">
          {!series.length || !data.length ? (
            <div className="flex h-[340px] items-center justify-center rounded-xl border border-dashed border-slate-700/60 bg-slate-900/40">
              <div className="text-center">
                <div className="mb-2 text-3xl opacity-40">📡</div>
                <p className="text-sm text-slate-400">
                  {!series.length
                    ? 'Select at least one signal to plot'
                    : 'No samples in this time range'}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 16, right: 18, left: -6, bottom: 8 }}>
                  <defs>
                    {series.map((item) => (
                      <linearGradient
                        key={item.key}
                        id={`grad-${safeId(item.key)}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={lineColor(item)} stopOpacity={single ? 0.35 : 0.22} />
                        <stop offset="85%" stopColor={lineColor(item)} stopOpacity={0.03} />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Threshold zones (single signal only) */}
                  {single && !percentMode && single.range && single.warning !== null && (
                    <>
                      <ReferenceArea y1={0} y2={single.range[1]} fill="#34d399" fillOpacity={0.06} />
                      <ReferenceArea
                        y1={single.range[1]}
                        y2={single.warning}
                        fill="#fbbf24"
                        fillOpacity={0.07}
                      />
                      <ReferenceArea y1={single.warning} y2={yMax} fill="#f87171" fillOpacity={0.08} />
                    </>
                  )}

                  <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />

                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTick}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    minTickGap={48}
                  />

                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    domain={[0, yMax]}
                    width={48}
                    tickFormatter={(v: number) =>
                      percentMode ? `${Math.round(v)}%` : String(Math.round(v * 10) / 10)
                    }
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as Row;
                      return (
                        <div className="min-w-[200px] rounded-xl border border-slate-600/70 bg-slate-900/95 px-4 py-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md">
                          <div className="mb-2.5 text-[11px] font-medium text-slate-400">
                            {formatTick(label as number)}
                          </div>
                          {series.map((item) => {
                            const raw = row[`${item.key}__raw`];
                            if (typeof raw !== 'number') return null;
                            const status = statusOf(raw, item.warning, item.critical);
                            return (
                              <div key={item.key} className="mb-1.5 flex items-center justify-between gap-6 last:mb-0">
                                <span className="flex items-center gap-2 text-slate-300">
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{
                                      background: lineColor(item),
                                      boxShadow: `0 0 8px ${lineColor(item)}`,
                                    }}
                                  />
                                  {item.label}
                                </span>
                                <span
                                  className="font-mono font-bold"
                                  style={{ color: STATUS_HEX[status] }}
                                >
                                  {Math.round(raw * 100) / 100} {item.unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />

                  {/* Threshold lines */}
                  {single && !percentMode && single.warning !== null && (
                    <ReferenceLine
                      y={single.warning}
                      stroke="#fbbf24"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Warn ${single.warning}`,
                        fill: '#fbbf24',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  {single && !percentMode && single.critical !== null && (
                    <ReferenceLine
                      y={single.critical}
                      stroke="#f87171"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Crit ${single.critical}`,
                        fill: '#f87171',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  {percentMode && (
                    <ReferenceLine
                      y={100}
                      stroke="#f87171"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Critical limit 100%',
                        fill: '#f87171',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                  )}

                  {series.map((item) => (
                    <Area
                      key={item.key}
                      type="monotone"
                      dataKey={item.key}
                      stroke={lineColor(item)}
                      strokeWidth={single ? 2.8 : 2.2}
                      fill={`url(#grad-${safeId(item.key)})`}
                      dot={false}
                      connectNulls
                      activeDot={{
                        r: 6,
                        fill: lineColor(item),
                        stroke: '#0f172a',
                        strokeWidth: 2.5,
                        style: { filter: `drop-shadow(0 0 6px ${lineColor(item)})` },
                      }}
                      isAnimationActive={false}
                    />
                  ))}

                  {/* Interactive Brush */}
                  <Brush
                    dataKey="timestamp"
                    height={28}
                    stroke="#22d3ee"
                    fill="#0f172a"
                    tickFormatter={formatTick}
                    travellerWidth={8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
