import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { generateTimeSeriesData } from '../../data/machineMonitoringData';
import type { TimeSeriesPoint } from '../../data/machineMonitoringData';

interface TelemetryChartProps {
  machineId: string;
  metricKey: 'temperature' | 'vibration' | 'current' | 'power' | 'rpm';
  metricLabel: string;
  unit: string;
  normalRange: [number, number];
  warningThreshold: number;
  criticalThreshold: number;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  machineId,
  metricKey,
  metricLabel,
  unit,
  normalRange,
  warningThreshold,
  criticalThreshold,
}) => {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [data, setData] = useState<TimeSeriesPoint[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Generate initial data
  useEffect(() => {
    const pointsCount = timeRange === '1h' ? 30 : timeRange === '6h' ? 60 : timeRange === '24h' ? 90 : 120;
    const baseVal = (normalRange[0] + normalRange[1]) / 2;
    const variance = (normalRange[1] - normalRange[0]) * 0.4;
    const hasSpike = metricKey === 'vibration' || metricKey === 'temperature';

    const generated = generateTimeSeriesData(pointsCount, baseVal, variance, hasSpike);
    setData(generated);
  }, [machineId, metricKey, timeRange, normalRange]);

  // Real-time live data point pushing every 3 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setData((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const delta = (Math.random() - 0.48) * (normalRange[1] - normalRange[0]) * 0.15;
        let newValue = Math.max(0, Number((last.value + delta).toFixed(2)));

        const pointStatus: 'normal' | 'warning' | 'critical' = newValue > criticalThreshold ? 'critical' : newValue > warningThreshold ? 'warning' : 'normal';
        const updated: TimeSeriesPoint[] = [...prev.slice(1), { timestamp: timeStr, value: newValue, status: pointStatus }];
        return updated;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRefresh, normalRange, warningThreshold, criticalThreshold]);

  const latestVal = data.length > 0 ? data[data.length - 1].value : 0;
  const chartColor = latestVal > criticalThreshold ? '#E24C4C' : latestVal > warningThreshold ? '#F59E0B' : '#00A9AE';

  return (
    <div className="bg-panel border border-border rounded-[14px] p-5">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-head font-bold text-ink text-[16px]">{metricLabel} Telemetry Stream</h4>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal/10 text-teal border border-teal/20 font-semibold">
              {latestVal} {unit}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Normal: {normalRange[0]}–{normalRange[1]} {unit} • Warning &gt; {warningThreshold} {unit} • Critical &gt; {criticalThreshold} {unit}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime pulse button */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                : 'bg-slate-100 text-slate-600 border-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            {autoRefresh ? 'LIVE STREAMING' : 'PAUSED'}
          </button>

          {/* Time range selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-border text-xs font-medium">
            {(['1h', '6h', '24h', '7d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  timeRange === r ? 'bg-white text-ink font-bold shadow-sm' : 'text-muted hover:text-ink'
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
              domain={['auto', 'auto']}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  const status = val > criticalThreshold ? 'Critical' : val > warningThreshold ? 'Warning' : 'Normal';
                  const stColor = val > criticalThreshold ? '#E24C4C' : val > warningThreshold ? '#F59E0B' : '#1FA971';
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs font-mono border border-slate-700">
                      <div className="text-slate-400 mb-1">{label}</div>
                      <div className="text-sm font-bold flex items-center justify-between gap-4">
                        <span>{metricLabel}:</span>
                        <span style={{ color: stColor }}>{val} {unit}</span>
                      </div>
                      <div className="mt-1 text-[10.5px] uppercase font-bold text-slate-300">
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
              stroke="#F59E0B"
              strokeDasharray="4 4"
              label={{ value: `Warn (${warningThreshold})`, fill: '#F59E0B', fontSize: 10, position: 'insideTopRight' }}
            />
            <ReferenceLine
              y={criticalThreshold}
              stroke="#E24C4C"
              strokeDasharray="4 4"
              label={{ value: `Crit (${criticalThreshold})`, fill: '#E24C4C', fontSize: 10, position: 'insideTopRight' }}
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
