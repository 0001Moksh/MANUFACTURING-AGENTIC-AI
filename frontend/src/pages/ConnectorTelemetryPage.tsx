import React, { useMemo, useState } from 'react';
import { Activity, Download } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { MonitoringControls } from '../components/monitoring/MonitoringControls';
import { MetricTable } from '../components/monitoring/MetricTable';
import { useMonitoringData } from '../hooks/useMonitoringData';
import { pluginService } from '../services/api';
import { formatTelemetryDateTime } from '../utils/telemetryTime';

type Sample = { time: string; host: string; measurement: string; fields: Record<string, unknown> };
type Payload = { plugin_id: string; hosts: string[]; measurements: string[]; samples: Sample[]; sample_count: number; generated_at: string };

const CONNECTORS: Record<string, { name: string; description: string }> = {
  'telegraf-disk-monitoring': { name: 'Disk Monitoring', description: 'Filesystem capacity and disk I/O metrics across connected hosts.' },
  'telegraf-network-monitoring': { name: 'Network Monitoring', description: 'Interface traffic, packet errors, and dropped packets across connected hosts.' },
  'telegraf-mqtt-consumer': { name: 'MQTT Device Telemetry', description: 'Parsed measurements received from configured MQTT broker topics.' },
  'telegraf-modbus': { name: 'Modbus Monitoring', description: 'Register values polled from configured Modbus equipment.' },
  'telegraf-opcua': { name: 'OPC UA Monitoring', description: 'Process values read from configured OPC UA nodes.' },
  'iiiot-veda-network-diagnostics': { name: 'Network Diagnostics', description: 'Reachability, latency, ports, HTTP, DNS, certificate, and connection-state metrics.' },
  'iiiot-veda-email-monitoring': { name: 'Email Monitoring', description: 'SMTP or IMAP availability, response time, banner, and TLS certificate metrics.' },
  'iiiot-veda-server-monitoring': { name: 'Server Monitoring', description: 'Uptime, load, swap, processes, and selected service health.' },
  'iiiot-veda-desktop-monitoring': { name: 'Desktop Monitoring', description: 'Workstation operating-system and process health metrics.' },
  'iiiot-veda-docker-monitoring': { name: 'Docker Monitoring', description: 'Container state, resource usage, health, and engine metrics.' },
  'iiiot-veda-kubernetes-monitoring': { name: 'Kubernetes Monitoring', description: 'Pod and container metrics collected from the Kubernetes API.' },
  'iiiot-veda-mongodb-monitoring': { name: 'MongoDB Monitoring', description: 'MongoDB database, operation, connection, and replica-set metrics.' },
  'iiiot-veda-mysql-monitoring': { name: 'MySQL Monitoring', description: 'MySQL connections, queries, InnoDB, replication, and process metrics.' },
  'iiiot-veda-redis-monitoring': { name: 'Redis Monitoring', description: 'Redis memory, clients, persistence, replication, and command metrics.' },
  'iiiot-veda-sql-monitoring': { name: 'Generic SQL Monitoring', description: 'Metrics returned by configured read-only SQL queries.' },
  'iiiot-veda-sqlserver-monitoring': { name: 'SQL Server Monitoring', description: 'SQL Server performance counters, waits, I/O, and server metrics.' },
  'iiiot-veda-influxdb-monitoring': { name: 'InfluxDB Monitoring', description: 'InfluxDB service health, HTTP, query, write, storage, task, memory, and runtime metrics.' },
  'iiiot-veda-exec-monitoring': { name: 'Command Monitoring', description: 'Metrics emitted by a configured local executable or script.' },
  'iiiot-veda-http-monitoring': { name: 'HTTP Metric Collection', description: 'Metrics polled from configured HTTP endpoints.' },
  'iiiot-veda-http-listener': { name: 'HTTP Metric Listener', description: 'Metrics pushed into the configured HTTP listener.' },
  'iiiot-veda-nvidia-monitoring': { name: 'NVIDIA GPU Monitoring', description: 'GPU utilization, memory, temperature, power, and process metrics.' },
  'iiiot-veda-s7-monitoring': { name: 'Siemens S7 Monitoring', description: 'Values read from configured Siemens S7 PLC addresses.' },
  'iiiot-veda-syslog-ingestion': { name: 'Syslog Ingestion', description: 'Parsed RFC3164 and RFC5424 system and device events.' },
  'iiiot-veda-cisco-telemetry': { name: 'Cisco Model-Driven Telemetry', description: 'Streaming telemetry received from supported Cisco equipment.' },
  'iiiot-veda-system-monitoring': { name: 'Extended System Monitoring', description: 'System uptime, load averages, and logged-in user metrics.' },
  'iiiot-veda-opentelemetry': { name: 'OpenTelemetry Ingestion', description: 'OpenTelemetry metrics, logs, traces, and profiles received over gRPC.' },
  'iiiot-veda-nginx-monitoring': { name: 'NGINX Monitoring', description: 'NGINX connection and request metrics from stub_status.' },
  'iiiot-veda-csv-ingestion': { name: 'CSV Ingestion', description: 'Metrics parsed from configured CSV files.' },
  'iiiot-veda-grok-ingestion': { name: 'Grok Log Parsing', description: 'Metrics extracted from tailed logs using Grok patterns.' },
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
  const allFieldNames = useMemo(() => [...new Set(samples.flatMap(row => Object.keys(row.fields)))], [samples]);
  const fieldNames = allFieldNames.slice(0, 12);
  const recent = samples.slice(-250).reverse();
  const exportCsv = () => {
    const headers = ['time', 'host', 'measurement', ...allFieldNames];
    const quote = (value: unknown) => `"${display(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [headers.join(','), ...samples.map(row => [formatTelemetryDateTime(row.time), row.host, row.measurement, ...allFieldNames.map(field => row.fields[field])].map(quote).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${pluginId}-telemetry.csv`; anchor.click(); URL.revokeObjectURL(url);
  };
  if (!connector) return <div className="p-6 text-sm text-red-600">Unsupported connector.</div>;
  return <div className="min-h-full space-y-5 bg-canvas p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink"><Activity className="text-teal" />{connector.name}</h1><p className="mt-1 text-sm text-muted">{connector.description}</p></div><div className="flex flex-wrap gap-2"><MonitoringControls {...monitor} /><span className={`rounded-lg border border-border-color px-3 py-2 text-xs ${monitor.error ? 'text-red-600' : 'text-green'}`}>{monitor.error ? 'Unavailable' : monitor.refreshSeconds ? 'Live' : 'Paused'}</span></div></header>
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm text-muted">Host <select value={host} onChange={event => setHost(event.target.value)} className="ml-2 rounded-lg border border-border-color bg-panel p-2"><option value="">All hosts</option>{(monitor.data?.hosts || []).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm text-muted">Measurement <select value={measurement} onChange={event => setMeasurement(event.target.value)} className="ml-2 rounded-lg border border-border-color bg-panel p-2"><option value="">All measurements</option>{(monitor.data?.measurements || []).map(value => <option key={value}>{value}</option>)}</select></label><button disabled={!samples.length} onClick={exportCsv} className="ml-auto flex items-center gap-2 rounded-lg border border-border-color bg-panel px-3 py-2 text-sm disabled:opacity-50"><Download size={16} />Export CSV</button></div>
    {monitor.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{monitor.error}</p>}
    {!monitor.loading && !monitor.error && !samples.length && <p className="rounded-xl border border-border-color bg-panel p-8 text-center text-sm text-muted">No connector samples were found. Check the connector settings in the downloaded bundle and confirm that the source is reachable.</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Samples</p><strong className="mt-2 block text-2xl">{samples.length.toLocaleString()}</strong></div><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Hosts</p><strong className="mt-2 block text-2xl">{new Set(samples.map(row => row.host)).size}</strong></div><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Measurements</p><strong className="mt-2 block text-2xl">{new Set(samples.map(row => row.measurement)).size}</strong></div><div className="rounded-xl border border-border-color bg-panel p-4"><p className="text-sm text-muted">Metric fields</p><strong className="mt-2 block text-2xl">{allFieldNames.length.toLocaleString()}</strong></div></section>
    <section className="overflow-hidden rounded-xl border border-border-color bg-panel"><h2 className="p-4 font-bold text-ink">Recent connector metrics</h2><MetricTable headers={['Time (Asia/Kolkata)', 'Host', 'Measurement', ...fieldNames]} rows={recent.map(row => [formatTelemetryDateTime(row.time), row.host, row.measurement, ...fieldNames.map(field => display(row.fields[field]))])} empty="No connector metrics available." /></section>
    <p className="text-xs text-muted">Showing up to 250 recent rows and 12 fields in the table. CSV export includes all {allFieldNames.length.toLocaleString()} discovered fields. The API retains up to 5,000 rows per request. Last refreshed: {monitor.data?.generated_at ? formatTelemetryDateTime(monitor.data.generated_at) : '—'}.</p>
  </div>;
};
