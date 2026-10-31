import { MonitoringControls } from '../components/monitoring/MonitoringControls';
import { MetricTable } from '../components/monitoring/MetricTable';
import { useMonitoringData } from '../hooks/useMonitoringData';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Cpu, Download, Gauge, Leaf, Server } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { pluginService } from '../services/api';

type CpuSample = {
  time: string; host: string; cpu: string;
  usage_active: number | null; usage_user: number | null; usage_system: number | null;
  usage_idle: number | null; usage_iowait: number | null; usage_steal: number | null;
  usage_nice: number | null; usage_irq: number | null; usage_softirq: number | null;
};
type ProcessMetric = { pid: number; name: string; command: string; cpu_percent: number; memory_bytes: number; status: string; username?: string };
type ServiceMetric = { name: string; instances: number; cpu_percent: number; memory_bytes: number };
type CpuPayload = { sample_count: number; hosts: string[]; samples: CpuSample[]; process_count: number; processes: ProcessMetric[]; services: ServiceMetric[]; generated_at: string };
type HostSummary = { host: string; latest: number; previous: number; cores: CpuSample[]; time: string };

const BREAKDOWN_COLORS = ['#21B573', '#F59E35', '#8555E8', '#E5525D', '#9AAAC0'];
const PANEL = 'rounded-xl border border-[#DEE6F0] bg-white shadow-[0_2px_12px_rgba(25,52,82,0.04)]';
const pct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const memoryLabel = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;

function statusFor(value: number) {
  if (value >= 85) return { label: 'Critical', style: 'bg-red-50 text-red-600' };
  if (value >= 70) return { label: 'High', style: 'bg-amber-50 text-amber-700' };
  return { label: 'Normal', style: 'bg-emerald-50 text-emerald-700' };
}



export const CpuUtilizationPage: React.FC = () => {
  const { data, rangeMinutes, setRangeMinutes, refreshSeconds, refreshInput, setRefreshInput, loading, error, load, applyRefresh } = useMonitoringData<CpuPayload>(pluginService.getCpuUtilization, 'CPU');
  const [metricTab, setMetricTab] = useState<'core' | 'process' | 'service'>('core');

  const samples = useMemo(() => data?.samples || [], [data]);
  const hostSummaries = useMemo<HostSummary[]>(() => (data?.hosts || []).map(host => {
    const hostSamples = samples.filter(sample => sample.host === host);
    const totals = hostSamples.filter(sample => sample.cpu === 'cpu-total');
    const latestTotal = totals.at(-1);
    const previousTotal = totals.length > 1 ? totals.at(-2) : latestTotal;
    const latestCoreTime = [...hostSamples].reverse().find(sample => sample.cpu !== 'cpu-total')?.time || '';
    const cores = hostSamples.filter(sample => sample.cpu !== 'cpu-total' && sample.time === latestCoreTime);
    return { host, latest: latestTotal?.usage_active || 0, previous: previousTotal?.usage_active || 0, cores, time: latestTotal?.time || latestCoreTime };
  }), [data, samples]);

  const overall = hostSummaries.length ? hostSummaries.reduce((sum, item) => sum + item.latest, 0) / hostSummaries.length : 0;
  const previousOverall = hostSummaries.length ? hostSummaries.reduce((sum, item) => sum + item.previous, 0) / hostSummaries.length : 0;
  const change = overall - previousOverall;
  const totalCores = hostSummaries.reduce((sum, item) => sum + item.cores.length, 0);
  const allCores = hostSummaries.flatMap(item => item.cores.map(core => ({ ...core, host: item.host })));
  const alerts = allCores.filter(core => (core.usage_active || 0) >= 85).length;
  const processes = data?.processes || [];
  const services = data?.services || [];

  const trendData = useMemo(() => {
    const buckets = new Map<string, CpuSample[]>();
    samples.filter(sample => sample.cpu === 'cpu-total').forEach(sample => {
      const key = sample.time.slice(0, 16);
      buckets.set(key, [...(buckets.get(key) || []), sample]);
    });
    return [...buckets.values()].map(rows => ({
      label: timeLabel(rows[0].time),
      active: rows.reduce((sum, row) => sum + (row.usage_active || 0), 0) / rows.length,
      user: rows.reduce((sum, row) => sum + (row.usage_user || 0), 0) / rows.length,
      system: rows.reduce((sum, row) => sum + (row.usage_system || 0), 0) / rows.length,
    }));
  }, [samples]);

  const latestTotals = hostSummaries.map(summary => samples.filter(sample => sample.host === summary.host && sample.cpu === 'cpu-total').at(-1)).filter(Boolean) as CpuSample[];
  const averageMetric = (key: keyof CpuSample) => latestTotals.length ? latestTotals.reduce((sum, row) => sum + (Number(row[key]) || 0), 0) / latestTotals.length : 0;
  const breakdown = [
    { name: 'User', value: averageMetric('usage_user') }, { name: 'System', value: averageMetric('usage_system') },
    { name: 'I/O Wait', value: averageMetric('usage_iowait') }, { name: 'Steal', value: averageMetric('usage_steal') },
    { name: 'Idle', value: averageMetric('usage_idle') },
  ];
  const displayedBreakdown = breakdown.some(item => item.value > 0)
    ? breakdown
    : breakdown.map(item => ({ ...item, value: item.name === 'Idle' ? 100 : 0 }));
  const coreNames = [...new Set(allCores.map(core => core.cpu))].sort((a, b) => Number(a.replace('cpu', '')) - Number(b.replace('cpu', '')));

  const exportCsv = () => {
    const header = 'time,host,cpu,active,user,system,idle,io_wait\n';
    const rows = samples.map(item => [item.time, item.host, item.cpu, item.usage_active, item.usage_user, item.usage_system, item.usage_idle, item.usage_iowait].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([header + rows], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `cpu-utilization-${Date.now()}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  const cards = [
    { label: 'Total CPU Usage', value: pct(overall), note: `${Math.abs(change).toFixed(1)}% vs previous sample`, icon: Cpu, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total CPU Cores', value: String(totalCores), note: `Across ${hostSummaries.length} host${hostSummaries.length === 1 ? '' : 's'}`, icon: Server, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Active Processes', value: String(data?.process_count || 0), note: processes[0] ? `Top: ${processes[0].name} using ${pct(processes[0].cpu_percent)}` : 'Process snapshot', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
    { label: 'High Utilization Alerts', value: String(alerts), note: 'Cores at or above 85%', icon: AlertTriangle, color: 'text-red-500 bg-red-50' },
    { label: 'Available CPU Capacity', value: pct(100 - overall), note: 'Current estimated headroom', icon: Leaf, color: 'text-emerald-600 bg-emerald-50' },
  ];

  return <div className="min-h-full bg-[#F5F8FC] p-5 lg:p-6">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Cpu className="h-7 w-7" /></div>
        <div><h1 className="text-[22px] font-extrabold text-[#17233C]">CPU Monitoring</h1><p className="max-w-3xl text-xs text-slate-500">Real-time and historical CPU utilization across connected hosts. Analyze load, detect bottlenecks and review per-core performance.</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MonitoringControls {...{ rangeMinutes, setRangeMinutes, refreshInput, setRefreshInput, applyRefresh, load, loading }} />
        <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${error ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}><span className={`h-2 w-2 rounded-full ${error ? 'bg-amber-500' : 'bg-emerald-500'}`} />{error ? 'Reconnecting' : refreshSeconds > 0 ? 'Live' : 'Paused'}</span>
      </div>
    </header>

    {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {!error && !loading && samples.length === 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">No CPU samples were found for the selected time range. The analytics panels will populate as soon as IIIOT-Veda sends data.</div>}
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{cards.map(card => <div key={card.label} className={`${PANEL} flex gap-3 p-4`}><div className={`h-fit rounded-lg p-2 ${card.color}`}><card.icon className="h-5 w-5" /></div><div className="min-w-0"><div className="text-[11px] font-bold text-slate-500">{card.label}</div><div className="mt-1 flex items-center gap-2 text-[22px] font-extrabold text-[#17233C]">{card.value}{card.label === 'Total CPU Usage' && <span className={`flex items-center text-[10px] ${change > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(change).toFixed(1)}%</span>}</div><div className="mt-1 truncate text-[10px] text-slate-400">{card.note}</div></div></div>)}</section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className={`${PANEL} p-4`}><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[#17233C]">CPU Utilization Trend</h2><span className="text-[10px] text-slate-400">Average across hosts</span></div><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><defs><linearGradient id="cpuTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2584E8" stopOpacity={0.22}/><stop offset="95%" stopColor="#2584E8" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="#E7EDF5" vertical /><XAxis dataKey="label" tick={{ fontSize: 10, fill: '#718096' }} minTickGap={28} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#718096' }} /><Tooltip formatter={(value) => pct(Number(value))} /><Legend iconType="circle" iconSize={7} /><Area type="monotone" dataKey="active" name="Total" stroke="#2584E8" fill="url(#cpuTotal)" strokeWidth={2.2} dot={false} /><Area type="monotone" dataKey="user" name="User" stroke="#25B46F" fill="#25B46F" fillOpacity={0.06} strokeWidth={1.8} dot={false} /><Area type="monotone" dataKey="system" name="System" stroke="#F39A33" fill="#F39A33" fillOpacity={0.04} strokeWidth={1.8} dot={false} /></AreaChart></ResponsiveContainer></div></div>
        <div className={`${PANEL} p-4`}><h2 className="mb-3 text-sm font-extrabold text-[#17233C]">CPU Utilization Breakdown</h2><div className="grid grid-cols-[1.15fr_1fr] items-center"><div className="relative h-[245px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={displayedBreakdown} dataKey="value" innerRadius="58%" outerRadius="82%" paddingAngle={1}>{displayedBreakdown.map((entry, index) => <Cell key={entry.name} fill={BREAKDOWN_COLORS[index]} />)}</Pie><Tooltip formatter={(value) => pct(Number(value))} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-xl text-[#17233C]">{pct(overall)}</strong><span className="text-[9px] text-slate-400">Overall usage</span></div></div><div className="space-y-3">{breakdown.map((entry, index) => <div key={entry.name} className="flex items-center gap-2 text-[11px]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: BREAKDOWN_COLORS[index] }} /><span className="flex-1 text-slate-600">{entry.name}</span><strong>{pct(entry.value)}</strong></div>)}</div></div></div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.15fr_1fr]">
        <div className={`${PANEL} overflow-hidden`}><div className="border-b border-[#E8EDF4] px-4 py-3"><h2 className="text-sm font-extrabold text-[#17233C]">Top CPU Consumers</h2></div><div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-[#EDF1F6] bg-[#FAFBFD] px-4 py-2 text-[9px] font-bold text-slate-400"><span>Process / Service</span><span>CPU Usage</span><span>Memory</span><span>Status</span></div><div className="divide-y divide-[#EDF1F6]">{processes.slice(0, 5).map(process => { const status = statusFor(process.cpu_percent); return <div key={process.pid} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-[10px]"><div className="flex min-w-0 items-center gap-2"><span className="rounded-full bg-blue-600 p-1.5 text-white"><Cpu className="h-3 w-3" /></span><div className="min-w-0"><strong className="block truncate text-slate-700">{process.name}</strong><span className="text-[8px] text-slate-400">PID {process.pid}</span></div></div><strong>{pct(process.cpu_percent)}</strong><span>{memoryLabel(process.memory_bytes)}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${status.style}`}>{status.label}</span></div>; })}{processes.length === 0 && <div className="px-4 py-8 text-center text-xs text-slate-400">Process data is not available yet.</div>}</div></div>
        <div className={`${PANEL} overflow-hidden`}><div className="border-b border-[#E8EDF4] px-4 py-3"><h2 className="text-sm font-extrabold text-[#17233C]">CPU Utilization by Host</h2></div><div className="divide-y divide-[#EDF1F6]">{hostSummaries.map(summary => { const delta = summary.latest - summary.previous; const status = statusFor(summary.latest); return <div key={summary.host} className="grid grid-cols-[1fr_1.2fr_auto] items-center gap-3 px-4 py-3 text-[10px]"><div><strong className="text-[11px] text-slate-700">{summary.host}</strong><div className="text-slate-400">{summary.cores.length} cores</div></div><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${clamp(summary.latest)}%` }} /></div><strong>{pct(summary.latest)}</strong></div><div><span className={`rounded-full px-2 py-1 font-bold ${status.style}`}>{status.label}</span><div className={`mt-1 text-center ${delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%</div></div></div>; })}</div></div>
        <div className={`${PANEL} overflow-hidden`}><div className="border-b border-[#E8EDF4] px-4 py-3"><h2 className="text-sm font-extrabold text-[#17233C]">Optimization Suggestions</h2></div><div className="space-y-2 p-3">{hostSummaries.map(summary => { const high = summary.latest >= 70; return <div key={summary.host} className="flex gap-3 rounded-lg border border-[#E8EDF4] p-3"><div className={`h-fit rounded-lg p-2 ${high ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{high ? <Gauge className="h-4 w-4" /> : <Leaf className="h-4 w-4" />}</div><div><div className="text-[11px] font-bold text-slate-700">{high ? `Review load on ${summary.host}` : `${summary.host} has available capacity`}</div><p className="mt-1 text-[9px] leading-relaxed text-slate-400">{high ? `CPU is ${pct(summary.latest)}. Check the highest-utilized cores and running workloads.` : `Current CPU usage is ${pct(summary.latest)} with ${pct(100 - summary.latest)} headroom.`}</p></div></div>; })}</div></div>
      </section>

      <section className={`${PANEL} overflow-hidden`}><div className="flex items-center justify-between px-4 pt-3"><h2 className="text-sm font-extrabold text-[#17233C]">Detailed CPU Metrics</h2><button onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-[#DEE6F0] px-3 py-2 text-[10px] font-bold text-slate-600"><Download className="h-3.5 w-3.5" />Export</button></div><div className="flex gap-7 border-b border-[#E8EDF4] px-4 pt-2 text-[10px] font-semibold">{([['core', 'Per Core'], ['process', 'Per Process'], ['service', 'Per Service']] as const).map(([key, label]) => <button key={key} onClick={() => setMetricTab(key)} className={`border-b-2 px-2 pb-2 transition-colors ${metricTab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{label}</button>)}</div>
        {metricTab === 'core' && <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-[10px]"><thead className="bg-[#F8FAFD] text-slate-500"><tr><th className="px-3 py-2.5 font-bold">Host / Server</th>{coreNames.map(core => <th key={core} className="px-3 py-2.5 font-bold">CPU Core {core.replace('cpu', '')}</th>)}<th className="px-3 py-2.5 font-bold">Avg. Usage</th></tr></thead><tbody>{hostSummaries.map(summary => <tr key={summary.host} className="border-t border-[#EDF1F6]"><td className="px-3 py-2.5 font-bold">{summary.host}</td>{coreNames.map(name => <td key={name} className="px-3 py-2.5">{pct(summary.cores.find(core => core.cpu === name)?.usage_active)}</td>)}<td className={`px-3 py-2.5 font-extrabold ${summary.latest >= 70 ? 'text-red-500' : summary.latest >= 50 ? 'text-amber-500' : 'text-emerald-600'}`}>{pct(summary.latest)}</td></tr>)}</tbody></table></div>}
        {metricTab === 'process' && <MetricTable headers={['Process', 'PID', 'CPU Usage', 'Memory', 'Status', 'User']} rows={processes.map(process => [process.name, String(process.pid), pct(process.cpu_percent), memoryLabel(process.memory_bytes), process.status, process.username || '—'])} empty="No process metrics are available." />}
        {metricTab === 'service' && <MetricTable headers={['Service / Workload', 'Instances', 'CPU Usage', 'Memory', 'Status']} rows={services.map(service => [service.name, String(service.instances), pct(service.cpu_percent), memoryLabel(service.memory_bytes), statusFor(service.cpu_percent).label])} empty="No service metrics are available." />}
      </section>
      <div className="flex items-center justify-between text-[10px] text-slate-400"><span>{data?.sample_count.toLocaleString()} samples loaded</span><span>Last updated {data?.generated_at ? new Date(data.generated_at).toLocaleTimeString() : '—'} · Auto-refresh {refreshSeconds === 0 ? 'off' : `every ${refreshSeconds}s`}</span></div>
    </div>
  </div>;
};
