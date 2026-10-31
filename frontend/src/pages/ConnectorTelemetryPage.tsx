import React, { useMemo, useState } from 'react';
import { Activity, Download } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { MonitoringControls } from '../components/monitoring/MonitoringControls';
import { MetricTable } from '../components/monitoring/MetricTable';
import { useMonitoringData } from '../hooks/useMonitoringData';
import { pluginService } from '../services/api';

type Sample = { time: string; host: string; measurement: string; fields: Record<string, unknown> };
type Payload = { plugin_id: string; hosts: string[]; measurements: string[]; samples: Sample[]; sample_count: number; generated_at: string };

const CONNECTORS: Record<string, { name: string; description: string }> = {
  'telegraf-disk-monitoring': { name: 'Disk Monitoring', description: 'Filesystem capacity and disk I/O metrics across connected hosts.' },
  'telegraf-network-monitoring': { name: 'Network Monitoring', description: 'Interface traffic, packet errors, and dropped packets across connected hosts.' },
  'telegraf-mqtt-consumer': { name: 'MQTT Device Telemetry', description: 'Parsed measurements received from configured MQTT broker topics.' },
  'telegraf-modbus': { name: 'Modbus Monitoring', description: 'Register values polled from configured Modbus equipment.' },
  'telegraf-opcua': { name: 'OPC UA Monitoring', description: 'Process values read from configured OPC UA nodes.' },
};

const display = (value: unknown) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export const ConnectorTelemetryPage: React.FC = () => {
  const { pluginId = '' } = useParams();
  const connector = CONNECTORS[pluginId];
  const fetcher = React.useCallback((minutes: number, limit: number, signal: AbortSignal) => pluginService.getConnectorTelemetry(pluginId, minutes, limit, signal), [pluginId]);
  const monitor = useMonitoringData<Payload>(fetcher, connector?.name || 'Connector');
  const [host, setHost] = useState('');
  const [measurement, setMeasurement] = useState('');
  const samples = useMemo(() => (monitor.data?.samples || []).filter(row => (!host || row.host === host) && (!measurement || row.measurement === measurement)), [monitor.data, host, measurement]);
  const fieldNames = useMemo(() => [...new Set(samples.flatMap(row => Object.keys(row.fields)))].slice(0, 12), [samples]);
  const recent = samples.slice(-250).reverse();
  const exportCsv = () => {
    const headers = ['time', 'host', 'measurement', ...fieldNames];
    const quote = (value: unknown) => `"${display(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [headers.join(','), ...samples.map(row => [row.time, row.host, row.measurement, ...fieldNames.map(field => row.fields[field])].map(quote).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${pluginId}-telemetry.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  if (!connector) return <div className="p-6 text-sm text-red-600">Unsupported connector.</div>;
  return <div className="min-h-full space-y-5 bg-canvas p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink"><Activity className="text-teal" />{connector.name}</h1><p className="mt-1 text-sm text-muted">{connector.description}</p></div><div className="flex flex-wrap gap-2"><MonitoringControls {...monitor} /><span className={`rounded-lg border border-border-color px-3 py-2 text-xs ${monitor.error ? 'text-red-600' : 'text-green'}`}>{monitor.error ? 'Unavailable' : monitor.refreshSeconds ? 'Live' : 'Paused'}</span></div></header>
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-muted">Host <select value={host} onChange={event => setHost(event.target.value)} className="ml-2 rounded-lg border border-border-color bg-panel p-2"><option value="">All hosts</option>{(monitor.data?.hosts || []).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm text-muted">Measurement <select value={measurement} onChange={event => setMeasurement(event.target.value)} className="ml-2 rounded-lg border border-border-color bg-panel p-2"><option value="">All measurements</option>{(monitor.data?.measurements || []).map(value => <option key={value}>{value}</option>)}</select></label><button disabled={!samples.length} onClick={exportCsv} className="ml-auto flex items-center gap-2 rounded-lg border border-border-color bg-panel px-3 py-2 text-sm disabled:opacity-50"><Download size={16} />Export CSV</button></div>
    {monitor.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{monitor.error}</p>}
    {!monitor.loading && !monitor.error && !samples.length && <p className="rounded-xl border border-border-color bg-panel p-8 text-center text-sm text-muted">No connector samples were found. Check the connector settings in the downloaded bundle and confirm that the source is reachable.</p>}
    <section className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Samples</p><strong className="mt-2 block text-2xl">{samples.length.toLocaleString()}</strong></div><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Hosts</p><strong className="mt-2 block text-2xl">{new Set(samples.map(row => row.host)).size}</strong></div><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Measurements</p><strong className="mt-2 block text-2xl">{new Set(samples.map(row => row.measurement)).size}</strong></div></section>
    <section className="overflow-hidden rounded-xl border border-border-color bg-panel"><h2 className="p-4 font-bold text-ink">Recent connector metrics</h2><MetricTable headers={['Time', 'Host', 'Measurement', ...fieldNames]} rows={recent.map(row => [new Date(row.time).toLocaleString(), row.host, row.measurement, ...fieldNames.map(field => display(row.fields[field]))])} empty="No connector metrics available." /></section>
    <p className="text-xs text-muted">Showing up to 250 recent rows and 12 discovered fields. The API retains up to 5,000 rows per request. Last refreshed: {monitor.data?.generated_at ? new Date(monitor.data.generated_at).toLocaleTimeString() : '—'}.</p>
  </div>;
};
