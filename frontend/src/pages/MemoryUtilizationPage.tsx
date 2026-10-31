import React, { useMemo, useState } from 'react';
import { Download, MemoryStick } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pluginService } from '../services/api';
import { useMonitoringData } from '../hooks/useMonitoringData';
import { MonitoringControls } from '../components/monitoring/MonitoringControls';
import { MetricTable } from '../components/monitoring/MetricTable';

type MemorySample = { time: string; host: string; total: number | null; used: number | null; available: number | null; free: number | null; cached: number | null; buffered: number | null; used_percent: number | null; available_percent: number | null };
type MemoryPayload = { samples: MemorySample[]; hosts: string[]; sample_count: number; generated_at: string; window_minutes: number };
const bytes = (value: number | null) => value == null ? '—' : `${(value / 1024 ** 3).toFixed(2)} GiB`;
const pct = (value: number | null) => value == null ? '—' : `${value.toFixed(1)}%`;
const panel = 'rounded-xl border border-border-color bg-panel p-4';

export const MemoryUtilizationPage: React.FC = () => {
  const monitor = useMonitoringData<MemoryPayload>(pluginService.getMemoryUtilization, 'Memory');
  const { data, loading, error } = monitor;
  const [host, setHost] = useState('');
  const samples = useMemo(() => (data?.samples || []).filter(row => !host || row.host === host), [data, host]);
  const latest = useMemo(() => [...new Map(samples.map(row => [row.host, row])).values()], [samples]);
  const now = Date.now();
  const isStale = (row: MemorySample) => now - Date.parse(row.time) > 120000;
  const fresh = latest.filter(row => !isStale(row));
  const sum = (field: 'total' | 'used' | 'available') => fresh.length && fresh.every(row => row[field] != null) ? fresh.reduce((total, row) => total + row[field]!, 0) : null;
  const total = sum('total');
  const used = sum('used');
  const usage = total && used != null ? 100 * used / total : null;
  const chart = samples.map(row => ({ ...row, timestamp: Date.parse(row.time) }));
  const exportCsv = () => {
    const fields: (keyof MemorySample)[] = ['time', 'host', 'total', 'used', 'available', 'used_percent', 'available_percent', 'free', 'cached', 'buffered'];
    const cell = (value: unknown) => `"${String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [fields.join(','), ...samples.map(row => fields.map(field => cell(row[field])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'memory-utilization.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  const status = loading && !data ? 'Loading' : error ? 'Unavailable' : !latest.length ? 'Awaiting data' : latest.some(isStale) ? 'Stale data' : monitor.refreshSeconds === 0 ? 'Refresh paused' : 'Live';
  return <div className="min-h-full space-y-5 bg-canvas p-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink"><MemoryStick className="text-teal" />Memory Monitoring</h1><p className="mt-1 text-sm text-muted">RAM capacity, usage and available memory across connected hosts.</p></div>
      <div className="flex flex-wrap items-center gap-2"><MonitoringControls {...monitor} /><span className="rounded-lg border border-border-color px-3 py-2 text-xs">{status}</span></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="text-sm text-muted">Host <select aria-label="Memory host" value={host} onChange={e => setHost(e.target.value)} className="ml-2 rounded-lg border border-border-color bg-panel p-2"><option value="">All hosts</option>{(data?.hosts || []).map(name => <option key={name}>{name}</option>)}</select></label><button disabled={!samples.length} onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-border-color bg-panel px-3 py-2 text-sm disabled:opacity-50"><Download size={16} />Export CSV</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!error && !loading && !samples.length && <p className={panel}>No memory samples for this host and time range. Install and verify Memory Monitoring from Plugins.</p>}
    {latest.some(isStale) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Some hosts have not sent data for over two minutes. Their readings are excluded from current totals.</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Total RAM', bytes(total)], ['Used RAM', bytes(used)], ['Available RAM', bytes(sum('available'))], ['RAM utilization', pct(usage)],
    ].map(([label, value]) => <div key={label} className={panel}><p className="text-sm text-muted">{label}</p><strong className="mt-2 block text-2xl text-ink">{value}</strong><p className="mt-1 text-xs text-muted">Across {fresh.length} reporting hosts</p></div>)}</section>
    <section className={panel}><h2 className="font-bold text-ink">Memory utilization over time</h2><p className="mb-4 text-xs text-muted">Select a host to view its trend. Percentages are reported by Telegraf; missing readings remain gaps.</p>
      {host && chart.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => new Date(value).toLocaleTimeString()} /><YAxis domain={[0, 100]} unit="%" /><Tooltip labelFormatter={value => new Date(Number(value)).toLocaleString()} /><Area dataKey="used_percent" name="Used RAM (%)" stroke="#0d9488" fill="#ccfbf1" connectNulls={false} /></AreaChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-muted">{host ? 'No samples in this time range.' : 'Choose a host above to view its memory history.'}</p>}
    </section>
    <section className="overflow-hidden rounded-xl border border-border-color bg-panel"><h2 className="p-4 font-bold text-ink">Latest memory metrics by host</h2><MetricTable headers={['Host', 'Total', 'Used', 'Available', 'Usage', 'Cached', 'Free', 'Last sample', 'Status']} rows={latest.map(row => [row.host, bytes(row.total), bytes(row.used), bytes(row.available), pct(row.used_percent), bytes(row.cached), bytes(row.free), new Date(row.time).toLocaleString(), isStale(row) ? 'Stale' : row.used_percent == null ? 'Unknown' : row.used_percent >= 85 ? 'High (≥85%)' : 'Normal'])} empty="No memory metrics available." /></section>
    <p className="text-xs text-muted">{samples.length.toLocaleString()} samples loaded (maximum 5,000). Bytes display as GiB. Cached/free fields vary by operating system; available memory can include reclaimable cache. High usage is a visual indicator, not a background notification. Last refreshed: {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'}.</p>
  </div>;
};
