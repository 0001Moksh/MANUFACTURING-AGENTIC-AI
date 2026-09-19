import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';
import type { SparkPoint, TimeSeriesPoint } from '../../data/machineMonitoringData';

interface TelemetryChartProps {
  machineId: string;
  metricKey: 'temperature' | 'vibration' | 'current' | 'power' | 'rpm';
  metricLabel: string;
  unit: string;
  normalRange: [number, number];
  warningThreshold: number;
  criticalThreshold: number;
  /** Historical points returned by InfluxDB for this metric */
  initialSeries?: SparkPoint[];
  /** Fires whenever the chart's own live value updates, so parent UI (KPI cards) can stay in sync */
  onLatestValue?: (value: number) => void;
}

const RANGE_MS: Record<'1h' | '6h' | '24h' | '7d', number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const formatTick = (ts: number | string) => {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  machineId,
  metricKey,
  metricLabel,
  unit,
  normalRange,
  warningThreshold,
  criticalThreshold,
  initialSeries = [],
  onLatestValue,
}) => {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');

  // ── Build + filter series ───────────────────────────────────────────────────
  const data = useMemo(() => {
    const pointStatus = (value: number): 'normal' | 'warning' | 'critical' =>
      value > criticalThreshold ? 'critical' : value > warningThreshold ? 'warning' : 'normal';

    if (!initialSeries.length) return [];

    // Convert to numeric timestamps for reliable filtering
    const parsed = initialSeries
      .map((p) => {
        const t = typeof p.t === 'number' ? p.t : new Date(p.t).getTime();
        return { raw: p, t, v: p.v };
      })
      .filter((p) => !isNaN(p.t));

    if (!parsed.length) return [];

    const newest = Math.max(...parsed.map((p) => p.t));
    const cutoff = newest - RANGE_MS[timeRange];

    return parsed
      .filter((p) => p.t >= cutoff)
      .map((p) => ({
        timestamp: p.t,
        value: p.v,
        status: pointStatus(p.v),
      }));
  }, [initialSeries, criticalThreshold, warningThreshold, timeRange]);

  // ── Live value reporting ────────────────────────────────────────────────────
  const latestVal = data.length > 0 ? data[data.length - 1].value : 0;
  const onLatestValueRef = useRef(onLatestValue);
  const lastReportedValRef = useRef<number | null>(null);

  useEffect(() => {
    onLatestValueRef.current = onLatestValue;
  }, [onLatestValue]);

  useEffect(() => {
    lastReportedValRef.current = null;
  }, [machineId, metricKey]);

  useEffect(() => {
    if (data.length > 0) {
      const latest = data[data.length - 1].value;
      if (lastReportedValRef.current !== latest) {
        lastReportedValRef.current = latest;
        onLatestValueRef.current?.(latest);
      }
    }
  }, [data]);

  // ── Colors & domains ────────────────────────────────────────────────────────
  const isCritical = latestVal > criticalThreshold;
  const isWarning = latestVal > warningThreshold;
  const chartColor = isCritical ? '#DC2626' : isWarning ? '#D97706' : '#0D9488';
  const statusLabel = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Normal';
  const statusBg = isCritical
    ? 'bg-red-50 text-red-700 border-red-200'
    : isWarning
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const dataMax = data.length ? Math.max(...data.map((d) => d.value)) : criticalThreshold;
  const reasonableCeiling = criticalThreshold * 1.6;
  const yMax = Math.min(Math.max(criticalThreshold * 1.15, dataMax * 1.08), reasonableCeiling);
  const yMin = 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h4 className="font-head font-bold text-slate-800 text-[16px] tracking-tight">
                {metricLabel}
              </h4>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBg}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: chartColor }}
                />
                {statusLabel}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="font-mono text-[22px] font-bold tracking-tight" style={{ color: chartColor }}>
                {latestVal}
              </span>
              <span className="text-sm font-medium text-slate-400">{unit}</span>
            </div>

            <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
              Normal {normalRange[0]}–{normalRange[1]} {unit}
              <span className="mx-1.5 text-slate-300">·</span>
              Warn &gt; {warningThreshold}
              <span className="mx-1.5 text-slate-300">·</span>
              Crit &gt; {criticalThreshold}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Source badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              INFLUXDB
            </div>

            {/* Time range segmented control */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 text-[12px] font-medium">
              {(['1h', '6h', '24h', '7d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
                    timeRange === r
                      ? 'bg-white text-slate-800 font-bold shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="px-2 sm:px-4 pb-4 pt-3">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              {/* Soft zone bands */}
              <ReferenceArea y1={yMin} y2={normalRange[1]} fill="#059669" fillOpacity={0.05} strokeWidth={0} />
              <ReferenceArea y1={normalRange[1]} y2={warningThreshold} fill="#D97706" fillOpacity={0.06} strokeWidth={0} />
              <ReferenceArea y1={warningThreshold} y2={yMax} fill="#DC2626" fillOpacity={0.07} strokeWidth={0} />

              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />

              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTick}
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
                domain={[yMin, yMax]}
                width={42}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const val = payload[0].value as number;
                  const status =
                    val > criticalThreshold ? 'Critical' : val > warningThreshold ? 'Warning' : 'Normal';
                  const stColor =
                    val > criticalThreshold ? '#DC2626' : val > warningThreshold ? '#D97706' : '#059669';

                  return (
                    <div className="bg-white/95 backdrop-blur-sm text-slate-800 px-3.5 py-2.5 rounded-xl shadow-xl text-xs border border-slate-200/80">
                      <div className="text-slate-400 mb-1.5 font-medium">
                        {formatTick(label as number)}
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="font-medium text-slate-600">{metricLabel}</span>
                        <span className="font-mono font-bold text-[13px]" style={{ color: stColor }}>
                          {val} {unit}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: stColor }}>
                        {status}
                      </div>
                    </div>
                  );
                }}
              />

              {/* Threshold lines */}
              <ReferenceLine
                y={warningThreshold}
                stroke="#D97706"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: `Warn ${warningThreshold}`,
                  fill: '#D97706',
                  fontSize: 10,
                  position: 'insideTopRight',
                  fontWeight: 600,
                }}
              />
              <ReferenceLine
                y={criticalThreshold}
                stroke="#DC2626"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{
                  value: `Crit ${criticalThreshold}`,
                  fill: '#DC2626',
                  fontSize: 10,
                  position: 'insideTopRight',
                  fontWeight: 600,
                }}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2.5}
                fill={`url(#grad-${metricKey})`}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: chartColor,
                  stroke: '#fff',
                  strokeWidth: 2.5,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};