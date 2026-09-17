import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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
  const [data, setData] = useState<TimeSeriesPoint[]>([]);

  useEffect(() => {
    const pointStatus = (value: number): 'normal' | 'warning' | 'critical' => (
      value > criticalThreshold ? 'critical' : value > warningThreshold ? 'warning' : 'normal'
    );
    const points = initialSeries.map((point) => ({
      timestamp: point.t,
      value: point.v,
      status: pointStatus(point.v),
    }));
    setData(points);
  }, [initialSeries, criticalThreshold, warningThreshold, timeRange]);

  const latestVal = data.length > 0 ? data[data.length - 1].value : 0;

  const onLatestValueRef = React.useRef(onLatestValue);
  useEffect(() => {
    onLatestValueRef.current = onLatestValue;
  }, [onLatestValue]);

  const lastReportedValRef = React.useRef<number | null>(null);

  // Reset lastReportedValRef when machine or metric changes
  useEffect(() => {
    lastReportedValRef.current = null;
  }, [machineId, metricKey]);

  // Report the latest value to parent whenever telemetry data updates
  useEffect(() => {
    if (data.length > 0) {
      const latest = data[data.length - 1].value;
      if (lastReportedValRef.current !== latest) {
        lastReportedValRef.current = latest;
        onLatestValueRef.current?.(latest);
      }
    }
  }, [data]);

  const chartColor = latestVal > criticalThreshold ? '#DC2626' : latestVal > warningThreshold ? '#D97706' : '#0D9488';

  // Compute a sensible y-axis ceiling so the critical band always has some headroom above it,
  // but capped so a single outlier/spike point can never blow the axis scale up (e.g. to 99997)
  const dataMax = data.length ? Math.max(...data.map((d) => d.value)) : criticalThreshold;
  const reasonableCeiling = criticalThreshold * 1.6;
  const yMax = Math.min(Math.max(criticalThreshold * 1.15, dataMax * 1.1), reasonableCeiling);
  const yMin = 0;

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-head font-bold text-slate-800 text-[16px]">{metricLabel} Telemetry Stream</h4>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
              {latestVal} {unit}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Normal: {normalRange[0]}–{normalRange[1]} {unit} • Warning &gt; {warningThreshold} {unit} • Critical &gt; {criticalThreshold} {unit}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime pulse button */}
          <button className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold flex items-center gap-1.5 border bg-emerald-50 text-emerald-700 border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            INFLUXDB SOURCE
          </button>

          {/* Time range selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
            {(['1h', '6h', '24h', '7d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  timeRange === r ? 'bg-white text-slate-800 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {/* Flat, light zone tints — no stripes/texture, just three clean bands */}
            <ReferenceArea y1={yMin} y2={normalRange[1]} fill="#059669" fillOpacity={0.06} strokeWidth={0} />
            <ReferenceArea y1={normalRange[1]} y2={warningThreshold} fill="#D97706" fillOpacity={0.07} strokeWidth={0} />
            <ReferenceArea y1={warningThreshold} y2={yMax} fill="#DC2626" fillOpacity={0.08} strokeWidth={0} />

            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              domain={[yMin, yMax]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  const status = val > criticalThreshold ? 'Critical' : val > warningThreshold ? 'Warning' : 'Normal';
                  const stColor = val > criticalThreshold ? '#DC2626' : val > warningThreshold ? '#D97706' : '#059669';
                  return (
                    <div className="bg-white text-slate-800 p-3 rounded-lg shadow-xl text-xs font-mono border border-slate-200">
                      <div className="text-slate-400 mb-1">{label}</div>
                      <div className="text-sm font-bold flex items-center justify-between gap-4">
                        <span>{metricLabel}:</span>
                        <span style={{ color: stColor }}>{val} {unit}</span>
                      </div>
                      <div className="mt-1 text-[10.5px] uppercase font-bold text-slate-500">
                        Status: <span style={{ color: stColor }}>{status}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Threshold lines */}
            <ReferenceLine
              y={warningThreshold}
              stroke="#D97706"
              strokeDasharray="4 4"
              label={{ value: `Warn (${warningThreshold})`, fill: '#D97706', fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              y={criticalThreshold}
              stroke="#DC2626"
              strokeDasharray="4 4"
              label={{ value: `Crit (${criticalThreshold})`, fill: '#DC2626', fontSize: 10, position: 'insideTopRight' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={chartColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: chartColor, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};