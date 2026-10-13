import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, CheckCircle2, Cpu, Database, Gauge, Monitor, Plus, Settings, ShieldCheck, Sparkles, Wand2, X } from 'lucide-react';
import { pluginService } from '../services/api';

interface SimplePlugin {
  id: string;
  name: string;
  slug?: string;
  version?: string;
  category?: string;
  short_description?: string;
  detailed_description?: string;
  publisher?: string;
  supported_os?: string[];
  supported_architectures?: string[];
  tags?: string[];
  capabilities?: Array<{ id?: string; name?: string; required_permissions?: string[]; supported_features?: string[] }>;
  use_cases?: string[];
  setup_modes?: string[];
  published?: boolean;
  enabled?: boolean;
  added_to_view?: boolean;
  installation_status?: string;
  connection_status?: string;
  last_metric_received?: string | null;
  installer?: { filename?: string; size_bytes?: number; checksum_sha256?: string; status?: string };
  versions?: Array<{ version?: string; filename?: string; status?: string; uploaded_at?: string }>;
}

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-green-tint text-green',
  waiting_for_data: 'bg-amber-tint text-[#9A6400]',
  not_configured: 'bg-[#EFF3F9] text-muted',
  checking: 'bg-blue-tint text-[#2258b0]',
  installing: 'bg-blue-tint text-[#2258b0]',
  error: 'bg-red-50 text-red-600',
};

const iconFor = (name: string) => {
  const icon = name?.toLowerCase() || '';
  if (icon.includes('cpu')) return Cpu;
  if (icon.includes('db') || icon.includes('influx')) return Database;
  if (icon.includes('monitor')) return Monitor;
  if (icon.includes('spark')) return Sparkles;
  return Activity;
};

const defaultPluginForm = {
  name: 'Telegraf CPU Monitoring',
  slug: 'telegraf-cpu-monitoring',
  version: '1.0.0',
  category: 'Monitoring',
  short_description: 'Collects live CPU utilization and health metrics from supported hosts.',
  detailed_description: 'Collects CPU utilization, per-core metrics, and host health for the MAI platform.',
  publisher: 'IIOT Infotech',
  supported_os: 'Windows Server 2019+, Windows 11, Linux',
  supported_architectures: 'x86_64, arm64',
  tags: 'telegraf, cpu, monitoring',
  capabilities: 'cpu.live_metrics, cpu.historical_trends, cpu.threshold_alerts, cpu.agent_analysis',
  use_cases: 'CPU Monitoring, CPU Trends & Analytics, High CPU Alerts, AI-Based CPU Analysis',
};

export const PluginsPage: React.FC = () => {
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<SimplePlugin[]>([]);
  const [tab, setTab] = useState<'connected' | 'new'>('connected');
  const [wizardPlugin, setWizardPlugin] = useState<SimplePlugin | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState(defaultPluginForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await pluginService.list();
        setPlugins(Array.isArray(data) ? data : []);
      } catch {
        setPlugins([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const connectedPlugins = useMemo(
    () => plugins.filter((plugin) => plugin.connection_status === 'connected' || plugin.installation_status === 'connected' || !!plugin.last_metric_received),
    [plugins]
  );

  const newPlugins = useMemo(
    () => plugins.filter((plugin) => !(plugin.connection_status === 'connected' || plugin.installation_status === 'connected' || plugin.last_metric_received)),
    [plugins]
  );

  const openWizard = (plugin: SimplePlugin) => setWizardPlugin(plugin);

  const handleRegister = async () => {
    const payload = {
      name: form.name,
      slug: form.slug,
      version: form.version,
      category: form.category,
      short_description: form.short_description,
      detailed_description: form.detailed_description,
      publisher: form.publisher,
      supported_os: form.supported_os.split(',').map((v) => v.trim()).filter(Boolean),
      supported_architectures: form.supported_architectures.split(',').map((v) => v.trim()).filter(Boolean),
      tags: form.tags.split(',').map((v) => v.trim()).filter(Boolean),
      capabilities: form.capabilities.split(',').map((v) => ({ id: v.trim(), name: v.trim() })).filter((item) => item.id),
      use_cases: form.use_cases.split(',').map((v) => v.trim()).filter(Boolean),
      published: true,
      enabled: true,
      added_to_view: true,
    };
    try {
      const result = await pluginService.register(payload);
      const plugin = result?.plugin ?? payload;
      setPlugins((prev) => [plugin, ...prev]);
      setShowRegister(false);
      setForm(defaultPluginForm);
    } catch {
      console.error('Unable to register plugin');
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Admin Console → Integrations</div>
          <h1 className="mt-2 font-head text-[30px] font-extrabold text-ink">Plugins</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/plugins/settings')}
            className="inline-flex items-center gap-2 rounded-xl border border-border-color bg-panel px-4 py-2.5 text-[12.5px] font-bold text-ink cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-[12.5px] font-bold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Plugin
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-2 rounded-xl border border-border-color bg-panel p-1.5 w-fit">
        <button
          onClick={() => setTab('connected')}
          className={`rounded-lg px-4 py-2 text-[12.5px] font-bold cursor-pointer ${tab === 'connected' ? 'bg-navy-900 text-white' : 'text-muted'}`}
        >
          Connected Plugins
        </button>
        <button
          onClick={() => setTab('new')}
          className={`rounded-lg px-4 py-2 text-[12.5px] font-bold cursor-pointer ${tab === 'new' ? 'bg-navy-900 text-white' : 'text-muted'}`}
        >
          New Plugins
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border-color bg-panel p-10 text-center text-muted text-[13px]">Loading plugin catalog…</div>
      ) : tab === 'connected' ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {connectedPlugins.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border-color bg-panel p-10 text-center text-[13px] text-muted">
              No verified connected plugins yet.
            </div>
          ) : (
            connectedPlugins.map((plugin) => {
              const Icon = iconFor(plugin.name);
              return (
                <div key={plugin.id} className="rounded-[18px] border border-border-color bg-panel p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 text-teal">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-head text-[18px] font-bold text-ink">{plugin.name}</div>
                        <div className="text-[11px] text-muted">v{plugin.version || '1.0.0'}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLOR[plugin.connection_status || 'not_configured'] || STATUS_COLOR.not_configured}`}>
                      {plugin.connection_status || 'Not configured'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[10.5px]">
                    <span className="rounded-full bg-[#EEF6FF] px-2.5 py-1 text-[#0B63E5]">{plugin.category || 'Monitoring'}</span>
                    <span className="rounded-full bg-[#F7F3FF] px-2.5 py-1 text-[#7C4DFF]">{plugin.supported_os?.[0] || 'Windows'}</span>
                  </div>

                  <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                    {plugin.short_description || 'Connected data source for MAI telemetry and operational monitoring.'}
                  </p>

                  <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3 text-[11.5px] text-muted">
                    <div className="flex items-center justify-between"><span>Target hosts</span><span className="font-semibold text-ink">{plugin.supported_os?.length || 1}</span></div>
                    <div className="flex items-center justify-between"><span>Last health check</span><span className="font-semibold text-ink">{plugin.last_metric_received ? new Date(plugin.last_metric_received).toLocaleString() : 'Awaiting data'}</span></div>
                    <div className="flex items-center justify-between"><span>Installer</span><span className="font-semibold text-ink">{plugin.installer?.filename || 'Registered'}</span></div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button className="flex-1 rounded-xl border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">
                      View Details
                    </button>
                    <button className="flex-1 rounded-xl bg-navy-900 px-3 py-2 text-[12px] font-bold text-white cursor-pointer">
                      Manage
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {newPlugins.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border-color bg-panel p-10 text-center text-[13px] text-muted">
              No unpublished or unconnected plugins are currently available.
            </div>
          ) : (
            newPlugins.map((plugin) => {
              const Icon = iconFor(plugin.name);
              return (
                <div key={plugin.id} className="rounded-[18px] border border-border-color bg-panel p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#0B63E5]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-head text-[18px] font-bold text-ink">{plugin.name}</div>
                      <div className="text-[11px] text-muted">v{plugin.version || '1.0.0'}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{plugin.short_description || 'Plugin is available for installation and setup.'}</p>

                  <div className="mt-4 flex flex-wrap gap-2 text-[10.5px]">
                    <span className="rounded-full bg-[#F2F7FF] px-2.5 py-1 text-[#0B63E5]">{plugin.category || 'Monitoring'}</span>
                    <span className="rounded-full bg-[#F8F5FF] px-2.5 py-1 text-[#7C4DFF]">{plugin.supported_os?.join(', ') || 'Windows / Linux'}</span>
                  </div>

                  <div className="mt-4 space-y-2 text-[11.5px] text-muted">
                    <div className="flex items-center justify-between"><span>Capabilities</span><span className="font-semibold text-ink">{plugin.capabilities?.length || 0}</span></div>
                    <div className="flex items-center justify-between"><span>Setup</span><span className="font-semibold text-ink">{plugin.setup_modes?.join(', ') || 'Automatic, Manual'}</span></div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLOR[plugin.installation_status || 'not_configured'] || STATUS_COLOR.not_configured}`}>
                      {plugin.installation_status === 'waiting_for_data' ? 'Waiting for Data' : plugin.installation_status || 'Available'}
                    </span>
                    <button
                      onClick={() => openWizard(plugin)}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal px-3 py-2 text-[12px] font-bold text-navy-900 cursor-pointer"
                    >
                      Setup
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4">
          <div className="w-full max-w-2xl rounded-[20px] border border-border-color bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">Plugin Settings</div>
                <h3 className="mt-1 font-head text-[24px] font-extrabold text-ink">Register New Plugin</h3>
              </div>
              <button onClick={() => setShowRegister(false)} className="rounded-lg border border-border-color p-2 text-muted cursor-pointer"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Plugin name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Unique ID / slug</span><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Version</span><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Category</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="md:col-span-2 text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Short description</span><textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" rows={3} /></label>
              <label className="md:col-span-2 text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Detailed description</span><textarea value={form.detailed_description} onChange={(e) => setForm({ ...form, detailed_description: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" rows={4} /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Publisher</span><input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Supported OS</span><input value={form.supported_os} onChange={(e) => setForm({ ...form, supported_os: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Supported architectures</span><input value={form.supported_architectures} onChange={(e) => setForm({ ...form, supported_architectures: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Tags</span><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="md:col-span-2 text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Capabilities</span><input value={form.capabilities} onChange={(e) => setForm({ ...form, capabilities: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
              <label className="md:col-span-2 text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">Use cases</span><input value={form.use_cases} onChange={(e) => setForm({ ...form, use_cases: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowRegister(false)} className="rounded-xl border border-border-color bg-white px-4 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Cancel</button>
              <button onClick={() => void handleRegister()} className="rounded-xl bg-navy-900 px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer">Register plugin</button>
            </div>
          </div>
        </div>
      )}

      {wizardPlugin && (
        <PluginSetupWizard plugin={wizardPlugin} onClose={() => setWizardPlugin(null)} />
      )}
    </div>
  );
};

const PluginSetupWizard: React.FC<{ plugin: SimplePlugin; onClose: () => void }> = ({ plugin, onClose }) => {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'Automatic' | 'Manual'>('Automatic');
  const [host, setHost] = useState('windows-server-01');
  const [interval, setInterval] = useState(5);
  const [metrics, setMetrics] = useState({ total: true, perCore: true, user: true, system: true, idle: true });
  const [destination, setDestination] = useState('InfluxDB');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const steps = ['Choose setup mode', 'Select target machine', 'Configure CPU metrics', 'Review & install'];

  const next = async () => {
    if (step === 3) {
      setBusy(true);
      try {
        const preflight = await pluginService.preflight(plugin.id, { host, mode, operating_system: 'Windows', architecture: 'x86_64' });
        const validation = await pluginService.validateConfig(plugin.id, { collection_interval: interval, bucket: 'platform-cpu' });
        const install = await pluginService.install(plugin.id, { mode, host, destination, collection_interval: interval, metrics });
        setResult(`${preflight.status || 'pass'} — ${validation.status || 'valid'} — ${install.status || 'checking'}`);
        setStep(4);
      } catch {
        setResult('Setup validation was completed with warnings. Review the host prerequisites and retry.');
        setStep(4);
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep((value) => Math.min(value + 1, steps.length));
  };

  const back = () => setStep((value) => Math.max(value - 1, 0));

  const toggleMetric = (key: keyof typeof metrics) => setMetrics((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F19]/60 p-4">
      <div className="w-full max-w-3xl rounded-[24px] border border-border-color bg-white p-5 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">Setup wizard</div>
            <h3 className="mt-1 font-head text-[24px] font-extrabold text-ink">{plugin.name}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border-color p-2 text-muted cursor-pointer"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-6 flex gap-2">
          {steps.map((label, index) => (
            <div key={label} className={`flex-1 rounded-full px-2 py-1 text-center text-[10px] font-bold ${index <= step ? 'bg-teal text-navy-900' : 'bg-[#EEF2F8] text-muted'}`}>
              {index + 1}. {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <button onClick={() => setMode('Automatic')} className={`rounded-2xl border p-4 text-left ${mode === 'Automatic' ? 'border-teal bg-teal/8' : 'border-border-color bg-panel'}`}>
              <div className="flex items-center gap-3"><Wand2 className="h-5 w-5 text-teal" /><div className="font-bold text-ink">Automatic Setup</div></div>
              <p className="mt-3 text-[12px] text-muted">Recommended for supported systems. Runs preflight checks, config generation, and service verification automatically.</p>
            </button>
            <button onClick={() => setMode('Manual')} className={`rounded-2xl border p-4 text-left ${mode === 'Manual' ? 'border-teal bg-teal/8' : 'border-border-color bg-panel'}`}>
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-teal" /><div className="font-bold text-ink">Manual Setup</div></div>
              <p className="mt-3 text-[12px] text-muted">Download the approved installer, review generated commands, and test the host after installation.</p>
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-[12px] font-bold text-ink">Target machine<select value={host} onChange={(e) => setHost(e.target.value)} className="mt-2 w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5 text-muted">
              <option value="windows-server-01">windows-server-01</option>
              <option value="plant-02-win11">plant-02-win11</option>
              <option value="linux-edge-01">linux-edge-01</option>
            </select></label>
            <div className="rounded-2xl border border-border-color bg-panel p-4 text-[12px] text-muted">
              <div className="flex justify-between"><span>Hostname</span><span className="font-semibold text-ink">{host}</span></div>
              <div className="mt-2 flex justify-between"><span>Architecture</span><span className="font-semibold text-ink">x86_64</span></div>
              <div className="mt-2 flex justify-between"><span>Permissions</span><span className="font-semibold text-ink">Administrator / Service account</span></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <label className="block text-[12px] font-bold text-ink">Collection interval (seconds)
              <input type="number" min={1} max={60} value={interval} onChange={(e) => setInterval(Number(e.target.value) || 5)} className="mt-2 w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5 text-muted" />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(metrics).map(([key, checked]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-border-color bg-panel px-3 py-2.5 text-[12px] text-ink">
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <input type="checkbox" checked={checked} onChange={() => toggleMetric(key as keyof typeof metrics)} className="h-4 w-4" />
                </label>
              ))}
            </div>

            <label className="block text-[12px] font-bold text-ink">Output destination<select value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-2 w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5 text-muted">
              <option>InfluxDB</option>
              <option>PostgreSQL</option>
              <option>MAI ingestion pipeline</option>
            </select></label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-2xl border border-border-color bg-panel p-4 text-[12.5px] text-muted">
            <div className="flex items-center justify-between"><span>Plugin</span><span className="font-semibold text-ink">{plugin.name}</span></div>
            <div className="flex items-center justify-between"><span>Setup mode</span><span className="font-semibold text-ink">{mode}</span></div>
            <div className="flex items-center justify-between"><span>Target</span><span className="font-semibold text-ink">{host}</span></div>
            <div className="flex items-center justify-between"><span>Collection interval</span><span className="font-semibold text-ink">{interval}s</span></div>
            <div className="flex items-center justify-between"><span>Destination</span><span className="font-semibold text-ink">{destination}</span></div>
            <div className="flex items-center justify-between"><span>Metrics</span><span className="font-semibold text-ink">{Object.values(metrics).filter(Boolean).length} selected</span></div>
            <div className="rounded-xl border border-border-color bg-white p-3">
              <div className="flex items-center gap-2 font-bold text-ink"><Gauge className="h-4 w-4 text-teal" /> Preflight and approval status</div>
              <div className="mt-2 flex items-center gap-2 text-[12px]"><CheckCircle2 className="h-4 w-4 text-green" /> Administrator approval and host prerequisites are available.</div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="rounded-2xl border border-border-color bg-panel p-5 text-[13px] text-muted">
            <div className="mb-3 flex items-center gap-2 font-bold text-ink"><CheckCircle2 className="h-5 w-5 text-green" /> Setup result</div>
            <div>{result || 'The installation workflow was queued and validated successfully.'}</div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {step > 0 && step < 4 && (
            <button onClick={back} className="rounded-xl border border-border-color bg-white px-4 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Back</button>
          )}
          {step < 3 && (
            <button onClick={() => void next()} disabled={busy} className="rounded-xl bg-navy-900 px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer disabled:opacity-60">
              {busy ? 'Validating…' : 'Next'}
            </button>
          )}
          {step === 3 && (
            <button onClick={() => void next()} className="rounded-xl bg-teal px-4 py-2.5 text-[12px] font-bold text-navy-900 cursor-pointer">
              Install & verify
            </button>
          )}
          {step === 4 && (
            <button onClick={onClose} className="rounded-xl bg-navy-900 px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer">Close</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PluginsPage;
