import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle2, Cpu, Database, Download, Monitor, MemoryStick, Plus, Settings, Sparkles, Trash2, X } from 'lucide-react';
import { pluginService } from '../services/api';

interface SimplePlugin {
  id: string;
  name: string;
  version?: string;
  category?: string;
  short_description?: string;
  detailed_description?: string;
  target_os?: string;
  supported_os?: string[];
  supported_architectures?: string[];
  capabilities?: Array<{ id?: string; name?: string }>;
  setup_modes?: string[];
  installation_status?: string;
  connection_status?: string;
  last_metric_received?: string | null;
  installer?: { filename?: string; size_bytes?: number; checksum_sha256?: string; status?: string };
  overall_installer?: { filename?: string; size_bytes?: number; checksum_sha256?: string; status?: string };
}

interface CurrentSystem {
  hostname: string;
  operating_system: string;
  os_name: string;
  os_release: string;
  architecture: string;
  supported_package_types: string[];
}

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-green-tint text-green',
  registered: 'bg-blue-tint text-[#2258b0]',
  waiting_for_data: 'bg-amber-tint text-[#9A6400]',
  not_registered: 'bg-[#EFF3F9] text-muted',
  not_configured: 'bg-[#EFF3F9] text-muted',
  error: 'bg-red-50 text-red-600',
};

const TARGET_OS_OPTIONS = [
  { value: 'windows', label: 'Windows (.exe / .msi / .zip)', accept: '.exe,.msi,.zip' },
  { value: 'linux-deb', label: 'Linux (.deb)', accept: '.deb' },
  { value: 'linux-rpm', label: 'Linux (.rpm)', accept: '.rpm' },
  { value: 'linux-archive', label: 'Linux (.tar.gz / .tgz)', accept: '.tar.gz,.tgz' },
  { value: 'macos', label: 'macOS (.pkg / .dmg / archive)', accept: '.pkg,.dmg,.tar.gz,.tgz,.zip' },
];

const targetOsLabel = (value?: string) => TARGET_OS_OPTIONS.find((option) => option.value === value)?.label || value || 'Not selected';
const isRegistered = (plugin: SimplePlugin) => plugin.installation_status !== 'not_registered' && plugin.installer?.status === 'verified';
const isConnected = (plugin: SimplePlugin) => plugin.connection_status === 'connected' || plugin.installation_status === 'connected';

const iconFor = (name: string) => {
  const icon = name?.toLowerCase() || '';
  if (icon.includes('memory')) return MemoryStick;
  if (icon.includes('cpu')) return Cpu;
  if (icon.includes('db') || icon.includes('influx')) return Database;
  if (icon.includes('monitor')) return Monitor;
  if (icon.includes('spark')) return Sparkles;
  return Activity;
};

const defaultPluginForm = {
  plugin_id: 'telegraf-cpu-monitoring',
  name: 'Telegraf CPU Monitoring',
  version: '1.0.0',
  category: 'Monitoring',
  short_description: 'Collects live CPU utilization and health metrics from the current system.',
  detailed_description: 'Collects CPU utilization, per-core metrics, and host health for the MAI platform.',
  target_os: 'linux-rpm',
  architecture: 'x86_64',
};

const PLUGIN_OPTIONS = [
  { id: 'telegraf-cpu-monitoring', label: 'CPU Monitoring', name: 'Telegraf CPU Monitoring', description: defaultPluginForm.short_description, detail: defaultPluginForm.detailed_description },
  { id: 'telegraf-memory-monitoring', label: 'Memory Monitoring', name: 'Telegraf Memory Monitoring', description: 'Collects live RAM usage and available memory via Telegraf.', detail: 'Tracks total, used and available RAM and utilization trends per host.' },
  { id: 'telegraf-disk-monitoring', label: 'Disk Monitoring', name: 'Telegraf Disk Monitoring', description: 'Collects filesystem capacity, free space, inode usage, and disk I/O metrics.', detail: 'Tracks filesystem utilization and storage performance for servers and edge hosts.' },
  { id: 'telegraf-network-monitoring', label: 'Network Monitoring', name: 'Telegraf Network Monitoring', description: 'Collects interface traffic, packet, error, and drop metrics.', detail: 'Tracks host network throughput, errors, and dropped packets by interface.' },
  { id: 'telegraf-mqtt-consumer', label: 'MQTT Consumer', name: 'Telegraf MQTT Consumer', description: 'Consumes IoT and gateway telemetry from configured MQTT topics.', detail: 'Subscribes to a broker and stores parsed MQTT device messages in PostgreSQL.' },
  { id: 'telegraf-modbus', label: 'Modbus', name: 'Telegraf Modbus', description: 'Polls configured Modbus TCP or serial registers from industrial equipment.', detail: 'Reads configured registers from PLCs, meters, drives, and industrial devices.' },
  { id: 'telegraf-opcua', label: 'OPC UA', name: 'Telegraf OPC UA', description: 'Reads configured OPC UA nodes from PLCs, SCADA servers, and historians.', detail: 'Collects selected OPC UA process tags and stores them in PostgreSQL.' },
];

export const PluginsPage: React.FC = () => {
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<SimplePlugin[]>([]);
  const [tab, setTab] = useState<'connected' | 'new'>('connected');
  const [wizardPlugin, setWizardPlugin] = useState<SimplePlugin | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState(defaultPluginForm);
  const [installerFile, setInstallerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [removingPluginId, setRemovingPluginId] = useState<string | null>(null);

  const loadPlugins = async () => {
    setLoading(true);
    try {
      const data = await pluginService.list();
      setPlugins(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPlugins(); }, []);

  useEffect(() => {
    if (!showRegister) return;
    pluginService.getCurrentSystem().then((system: CurrentSystem) => {
      const target = system.supported_package_types?.[0] || system.operating_system;
      setForm((current) => ({ ...current, target_os: target, architecture: system.architecture }));
    }).catch(() => undefined);
  }, [showRegister]);

  const connectedPlugins = useMemo(() => plugins.filter(isConnected), [plugins]);
  const newPlugins = useMemo(() => plugins.filter((plugin) => isRegistered(plugin) && !isConnected(plugin)), [plugins]);

  const upsertPlugin = (updated: SimplePlugin) => {
    setPlugins((current) => current.some((item) => item.id === updated.id)
      ? current.map((item) => item.id === updated.id ? updated : item)
      : [updated, ...current]);
  };

  const handleRegister = async () => {
    if (!installerFile) return;
    setRegistering(true);
    setRegisterError(null);
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    payload.append('installer', installerFile);
    try {
      const result = await pluginService.register(payload);
      upsertPlugin(result.plugin);
      setShowRegister(false);
      setTab('new');
      setForm(defaultPluginForm);
      setInstallerFile(null);
    } catch (error: any) {
      setRegisterError(error?.response?.data?.detail || 'Unable to register the installation file.');
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async (plugin: SimplePlugin) => {
    if (!window.confirm(`Remove ${plugin.name}? It will also be removed from the Use-Case Library.`)) return;
    setRemovingPluginId(plugin.id);
    try {
      await pluginService.remove(plugin.id);
      setPlugins((current) => current.filter((item) => item.id !== plugin.id));
      if (wizardPlugin?.id === plugin.id) setWizardPlugin(null);
    } catch (error: any) {
      window.alert(error?.response?.data?.detail || 'Unable to remove the plugin.');
    } finally {
      setRemovingPluginId(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Admin Console → Integrations</div><h1 className="mt-2 font-head text-[30px] font-extrabold text-ink">Plugins</h1></div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/plugins/settings')} className="inline-flex items-center gap-2 rounded-xl border border-border-color bg-panel px-4 py-2.5 text-[12.5px] font-bold text-ink cursor-pointer"><Settings className="h-4 w-4" /> Settings</button>
          <button onClick={() => setShowRegister(true)} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-[12.5px] font-bold text-white cursor-pointer"><Plus className="h-4 w-4" /> Add Plugin</button>
        </div>
      </div>

      <div className="mb-6 flex w-fit gap-2 rounded-xl border border-border-color bg-panel p-1.5">
        {(['connected', 'new'] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-[12.5px] font-bold cursor-pointer ${tab === value ? 'bg-navy-900 text-white' : 'text-muted'}`}>{value === 'connected' ? 'Connected Plugins' : 'New Plugins'}</button>)}
      </div>

      {loading ? <div className="rounded-2xl border border-border-color bg-panel p-10 text-center text-[13px] text-muted">Loading plugin catalog…</div> : <PluginGrid plugins={tab === 'connected' ? connectedPlugins : newPlugins} connected={tab === 'connected'} onSetup={setWizardPlugin} onRemove={handleRemove} removingPluginId={removingPluginId} />}

      {showRegister && <RegisterPluginDialog form={form} setForm={setForm} installerFile={installerFile} setInstallerFile={setInstallerFile} busy={registering} error={registerError} onClose={() => { setShowRegister(false); setRegisterError(null); }} onRegister={handleRegister} />}
      {wizardPlugin && <PluginSetupDialog plugin={wizardPlugin} onClose={() => setWizardPlugin(null)} onUpdated={upsertPlugin} />}
    </div>
  );
};

const PluginGrid: React.FC<{ plugins: SimplePlugin[]; connected: boolean; onSetup: (plugin: SimplePlugin) => void; onRemove: (plugin: SimplePlugin) => void; removingPluginId: string | null }> = ({ plugins, connected, onSetup, onRemove, removingPluginId }) => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {plugins.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-border-color bg-panel p-10 text-center text-[13px] text-muted">{connected ? 'No verified connected plugins yet. Use Add Plugin to upload the Telegraf installer.' : 'No registered plugins are waiting for setup.'}</div> : plugins.map((plugin) => {
      const Icon = iconFor(plugin.name);
      const status = plugin.connection_status === 'connected' ? 'connected' : plugin.installation_status || 'registered';
      return <div key={plugin.id} className="rounded-[18px] border border-border-color bg-panel p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 text-teal"><Icon className="h-5 w-5" /></div><div><div className="font-head text-[18px] font-bold text-ink">{plugin.name}</div><div className="text-[11px] text-muted">v{plugin.version || '1.0.0'}</div></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLOR[status] || STATUS_COLOR.not_configured}`}>{status.replaceAll('_', ' ')}</span></div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{plugin.short_description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10.5px]"><span className="rounded-full bg-[#EEF6FF] px-2.5 py-1 text-[#0B63E5]">{plugin.category || 'Monitoring'}</span><span className="rounded-full bg-[#F7F3FF] px-2.5 py-1 text-[#7C4DFF]">{targetOsLabel(plugin.target_os)}</span><span className="rounded-full bg-[#F3F7F5] px-2.5 py-1 text-green">{plugin.supported_architectures?.[0] || 'x86_64'}</span></div>
        <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3 text-[11.5px] text-muted"><div className="flex justify-between gap-3"><span>Installer</span><span className="truncate font-semibold text-ink">{plugin.installer?.filename || 'Upload required'}</span></div><div className="flex justify-between gap-3"><span>Last metric</span><span className="font-semibold text-ink">{plugin.last_metric_received ? new Date(plugin.last_metric_received).toLocaleString() : 'Awaiting data'}</span></div></div>
        <div className="mt-5 flex gap-2"><button onClick={() => onSetup(plugin)} className="flex-1 rounded-xl bg-teal px-3 py-2.5 text-[12px] font-bold text-navy-900 cursor-pointer">{connected ? 'Manage Plugin' : 'Setup'}</button>{connected && <button onClick={() => onRemove(plugin)} disabled={removingPluginId === plugin.id} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-bold text-red-600 cursor-pointer hover:bg-red-100 disabled:cursor-wait disabled:opacity-60" title="Remove plugin"><Trash2 className="h-4 w-4" />{removingPluginId === plugin.id ? 'Removing…' : 'Remove'}</button>}</div>
      </div>;
    })}
  </div>
);

const RegisterPluginDialog: React.FC<{ form: typeof defaultPluginForm; setForm: React.Dispatch<React.SetStateAction<typeof defaultPluginForm>>; installerFile: File | null; setInstallerFile: (file: File | null) => void; busy: boolean; error: string | null; onClose: () => void; onRegister: () => void }> = ({ form, setForm, installerFile, setInstallerFile, busy, error, onClose, onRegister }) => {
  const accept = TARGET_OS_OPTIONS.find((option) => option.value === form.target_os)?.accept;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[20px] border border-border-color bg-white p-5 shadow-xl">
    <div className="mb-5 flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Connected Plugins</div><h3 className="mt-1 font-head text-[24px] font-extrabold text-ink">Add Telegraf Plugin</h3></div><button onClick={onClose} className="rounded-lg border border-border-color p-2 text-muted cursor-pointer"><X className="h-4 w-4" /></button></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Monitoring plugin"><select value={form.plugin_id} onChange={e => {
        const selected = PLUGIN_OPTIONS.find(option => option.id === e.target.value) || PLUGIN_OPTIONS[0];
        setForm({ ...form, plugin_id: selected.id, name: selected.name, short_description: selected.description, detailed_description: selected.detail });
      }} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5">{PLUGIN_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></Field>
      <Field label="Plugin name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5 text-ink outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/15" /></Field>
      <Field label="Version"><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field>
      <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field>
      <Field label="Target OS / package"><select value={form.target_os} onChange={(e) => { setForm({ ...form, target_os: e.target.value }); setInstallerFile(null); }} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5">{TARGET_OS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
      <Field label="Architecture"><select value={form.architecture} onChange={(e) => setForm({ ...form, architecture: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5"><option value="x86_64">x86_64</option><option value="arm64">arm64</option></select></Field>
      <div className="md:col-span-2"><Field label="Short description"><textarea rows={2} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field></div>
      <div className="md:col-span-2"><Field label="Detailed description"><textarea rows={3} value={form.detailed_description} onChange={(e) => setForm({ ...form, detailed_description: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field></div>
      <div className="md:col-span-2"><Field label="Telegraf installation file"><input type="file" accept={accept} required onChange={(e) => setInstallerFile(e.target.files?.[0] || null)} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /><span className="mt-1 block text-[10px] text-muted">Use the same target-specific Telegraf vendor package for every connector. MAI generates a connector-specific bundle while preserving connectors already installed.</span></Field></div>
    </div>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{error}</div>}
    <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl border border-border-color bg-white px-4 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Cancel</button><button onClick={onRegister} disabled={!installerFile || busy} className="rounded-xl bg-navy-900 px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer disabled:opacity-50">{busy ? 'Registering…' : 'Register Plugin'}</button></div>
  </div></div>;
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block text-[12px] text-muted"><span className="mb-2 block font-bold text-ink">{label}</span>{children}</label>;

const PluginSetupDialog: React.FC<{ plugin: SimplePlugin; onClose: () => void; onUpdated: (plugin: SimplePlugin) => void }> = ({ plugin, onClose, onUpdated }) => {
  const [step, setStep] = useState<0 | 1>(0);
  const [system, setSystem] = useState<CurrentSystem | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(plugin.installation_status === 'waiting_for_data' || plugin.connection_status === 'connected');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { pluginService.getCurrentSystem().then(setSystem).catch(() => setError('Unable to detect the current system.')); }, []);

  const osMatches = !!system && (plugin.target_os === system.operating_system || (system.operating_system === 'linux' && plugin.target_os?.startsWith('linux-')));
  const packageMatches = !!system && (system.operating_system !== 'linux' || system.supported_package_types.includes(plugin.target_os || ''));
  const architectureMatches = !!system && plugin.supported_architectures?.[0] === system.architecture;
  const compatible = osMatches && packageMatches && architectureMatches;
  const bundleExtension = plugin.target_os === 'windows' ? 'exe' : 'tar.gz';
  const pluginKind = plugin.id.replace('telegraf-', '').replace('-monitoring', '').replace('-consumer', '');
  const expectedBundleName = `mai-telegraf-${pluginKind}-${plugin.target_os}-${plugin.supported_architectures?.[0]}.${bundleExtension}`;

  const download = async () => {
    setBusy(true); setError(null);
    try {
      const result = await pluginService.downloadBundle(plugin.id);
      const objectUrl = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = result.filename || expectedBundleName;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setDownloaded(true);
      setMessage('Overall MAI plugin bundle generated, stored in the backend, and downloaded. Run its installation script on this system, then confirm installation.');
    } catch (reason: any) {
      setError(reason?.response?.data?.detail || 'Unable to generate and download the overall plugin bundle.');
    } finally {
      setBusy(false);
    }
  };

  const confirmInstallation = async () => {
    if (!system) return;
    setBusy(true); setError(null);
    try {
      const preflight = await pluginService.preflight(plugin.id, { operating_system: system.operating_system, architecture: system.architecture });
      if (preflight.status !== 'pass') {
        const failures = (preflight.checks || []).filter((check: any) => !check.passed).map((check: any) => check.message).join(' ');
        throw new Error(failures || 'The installer is not compatible with this system.');
      }
      const result = await pluginService.install(plugin.id, { confirmed: true, hostname: system.hostname });
      setConfirmed(true); setMessage(result.message); onUpdated(await pluginService.getById(plugin.id));
    } catch (reason: any) { setError(reason?.response?.data?.detail || reason?.message || 'Unable to confirm installation.'); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError(null);
    try {
      const result = await pluginService.test(plugin.id, {});
      setMessage(result.message); onUpdated(await pluginService.getById(plugin.id));
      if (!result.success) setError(result.verification_error
        ? `PostgreSQL verification failed: ${result.verification_error}`
        : 'No recent plugin data was found in PostgreSQL. Start Telegraf and check its PostgreSQL output configuration, then retry.');
    } catch (reason: any) { setError(reason?.response?.data?.detail || 'Verification failed.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F19]/60 p-4"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-border-color bg-white p-5 shadow-xl">
    <div className="mb-5 flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Setup Wizard</div><h3 className="mt-1 font-head text-[24px] font-extrabold text-ink">{plugin.name}</h3></div><button onClick={onClose} className="rounded-lg border border-border-color p-2 text-muted cursor-pointer"><X className="h-4 w-4" /></button></div>
    <div className="mb-6 grid grid-cols-2 gap-2">{['1. Select target machine', '2. Review & install'].map((label, index) => <div key={label} className={`rounded-full px-3 py-2 text-center text-[11px] font-bold ${step >= index ? 'bg-teal text-navy-900' : 'bg-[#EFF3F9] text-muted'}`}>{label}</div>)}</div>

    {step === 0 ? <>
      <div className="rounded-2xl border border-border-color bg-panel p-5"><div className="mb-1 font-bold text-ink">Current target machine</div><p className="mb-4 text-[11.5px] text-muted">Setup uses the machine currently running the MAI backend. There is no separate machine selection.</p>{system ? <div className="grid gap-3 text-[12px] text-muted md:grid-cols-2"><SystemDetail label="Hostname" value={system.hostname} /><SystemDetail label="Operating system" value={`${system.os_name} ${system.os_release}`} /><SystemDetail label="Architecture" value={system.architecture} /><SystemDetail label="Permissions" value={system.operating_system === 'windows' ? 'Administrator required' : 'sudo / administrator required'} /><SystemDetail label="Package support" value={system.supported_package_types.join(', ')} /></div> : <div className="text-[12px] text-muted">Detecting current system…</div>}{system && <div className={`mt-4 rounded-xl p-3 text-[12px] font-semibold ${compatible ? 'bg-green-tint text-green' : 'bg-red-50 text-red-600'}`}>{compatible ? 'Hostname, target OS, package type, and architecture are compatible.' : `This machine does not match ${targetOsLabel(plugin.target_os)} / ${plugin.supported_architectures?.[0]}.`}</div>}</div>
      {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{error}</div>}
      <div className="mt-6 flex justify-end"><button onClick={() => { setError(null); setStep(1); }} disabled={!compatible} className="rounded-xl bg-teal px-5 py-2.5 text-[12px] font-bold text-navy-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">Next: Review & install</button></div>
    </> : <>
      <div className="rounded-2xl border border-border-color bg-panel p-4"><div className="space-y-4 text-[12px] text-muted"><SystemDetail label="Plugin" value={plugin.name} /><SystemDetail label="Setup mode" value="Manual" /><SystemDetail label="Target" value={system?.hostname || 'Unknown'} /><SystemDetail label="Target OS" value={targetOsLabel(plugin.target_os)} /><SystemDetail label="Architecture" value={plugin.supported_architectures?.[0] || 'Unknown'} /><SystemDetail label="Telegraf installer" value={plugin.installer?.filename || 'Not uploaded'} /><SystemDetail label="Overall plugin bundle" value={plugin.overall_installer?.filename || expectedBundleName} /><SystemDetail label="Destination" value="PostgreSQL" /></div><div className={`mt-5 rounded-xl border p-3 ${compatible ? 'border-green/20 bg-green-tint' : 'border-red-200 bg-red-50'}`}><div className="flex items-center gap-2 text-[12px] font-bold text-ink"><Activity className="h-4 w-4 text-teal" /> Preflight and approval status</div><div className={`mt-2 flex items-center gap-2 text-[11.5px] ${compatible ? 'text-green' : 'text-red-600'}`}><CheckCircle2 className="h-4 w-4" /> {compatible ? 'Administrator approval and host prerequisites are available.' : 'The current machine is not compatible with this plugin bundle.'}</div></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-3"><ActionCard number="1" title="Download overall file" description="Generate and download the complete MAI plugin bundle. The Telegraf installer remains stored separately."><button onClick={() => void download()} disabled={!compatible || busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[11.5px] font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> {downloaded ? 'Downloaded' : 'Download Bundle'}</button></ActionCard><ActionCard number="2" title="Confirm installation" description="Run the bundle installer, then confirm that installation finished."><button onClick={() => void confirmInstallation()} disabled={(!downloaded && !confirmed) || busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[11.5px] font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> {confirmed ? 'Confirmed' : 'Confirm Installation'}</button></ActionCard><ActionCard number="3" title="Verify plugin" description="Verify that this plugin’s data is arriving in PostgreSQL."><button onClick={() => void verify()} disabled={!confirmed || busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[11.5px] font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><Activity className="h-4 w-4" /> Verify Plugin</button></ActionCard></div>
      {message && <div className="mt-4 rounded-xl bg-blue-tint p-3 text-[12px] text-[#2258b0]">{message}</div>}{error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{error}</div>}
      <div className="mt-6 flex justify-start"><button onClick={() => { setError(null); setStep(0); }} className="rounded-xl border border-border-color bg-white px-5 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Back</button></div>
    </>}
  </div></div>;
};

const SystemDetail: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="flex justify-between gap-3"><span>{label}</span><span className="text-right font-semibold text-ink">{value}</span></div>;
const ActionCard: React.FC<{ number: string; title: string; description: string; children: React.ReactNode }> = ({ number, title, description, children }) => <div className="flex flex-col rounded-2xl border border-border-color bg-panel p-4"><div className="text-[10px] font-bold uppercase text-teal">Step {number}</div><div className="mt-1 font-bold text-ink">{title}</div><p className="mb-4 mt-2 flex-1 text-[11.5px] text-muted">{description}</p>{children}</div>;

export default PluginsPage;
