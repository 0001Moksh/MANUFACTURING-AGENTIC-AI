import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle2, Cpu, Database, Download, Monitor, MemoryStick, Plus, Settings, Sparkles, Trash2, X } from 'lucide-react';
import { pluginService } from '../services/api';
import { formatTelemetryDateTime } from '../utils/telemetryTime';

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
  use_case_configs?: Record<string, { enabled: boolean; config: string }>;
}

interface CurrentSystem {
  hostname: string;
  operating_system: string;
  os_name: string;
  os_release: string;
  architecture: string;
  supported_package_types: string[];
}
interface InstallerAsset { id: string; display_name: string; target_os: string; architecture: string; filename: string }

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-green-tint text-green',
  disconnected: 'bg-red-50 text-red-600',
  idle: 'bg-amber-tint text-[#9A6400]',
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
  { value: 'macos', label: 'macOS (.pkg / .dmg)', accept: '.pkg,.dmg' },
];

const targetOsLabel = (value?: string) => TARGET_OS_OPTIONS.find((option) => option.value === value)?.label || value || 'Not selected';
const isConnected = (plugin: SimplePlugin) => plugin.installation_status === 'connected';

const iconFor = (name: string) => {
  const icon = name?.toLowerCase() || '';
  if (icon.includes('memory')) return MemoryStick;
  if (icon.includes('cpu')) return Cpu;
  if (icon.includes('db') || icon.includes('influx')) return Database;
  if (icon.includes('monitor')) return Monitor;
  if (icon.includes('spark')) return Sparkles;
  return Activity;
};

const brandedFilename = (filename?: string, fallback = 'Not uploaded') => filename ? filename.replace(/telegraf/gi, 'iiiot-veda') : fallback;

const defaultPluginForm = {
  plugin_id: 'telegraf-cpu-monitoring',
  name: 'IIIOT-Veda CPU Monitoring',
  version: '1.0.0',
  category: 'Monitoring',
  short_description: 'Collects CPU utilization and health metrics.',
  detailed_description: 'Separately registered CPU monitoring use case.',
  target_os: 'linux-rpm',
  architecture: 'x86_64',
};

export const PluginsPage: React.FC = () => {
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<SimplePlugin[]>([]);
  const [tab, setTab] = useState<'connected' | 'new'>('connected');
  const [wizardPlugin, setWizardPlugin] = useState<SimplePlugin | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState(defaultPluginForm);
  const [installerAssets, setInstallerAssets] = useState<InstallerAsset[]>([]);
  const [installerAssetId, setInstallerAssetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [removingPluginId, setRemovingPluginId] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<Record<string, string>>({});

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
  const newPlugins = useMemo(() => plugins.filter((plugin) => !isConnected(plugin)), [plugins]);

  const upsertPlugin = (updated: SimplePlugin) => {
    setPlugins((current) => current.some((item) => item.id === updated.id)
      ? current.map((item) => item.id === updated.id ? updated : item)
      : [updated, ...current]);
  };
  const openRegistration = (plugin?: SimplePlugin) => {
    const selected = plugin || newPlugins[0];
    if (selected) setForm({ ...defaultPluginForm, plugin_id: selected.id, name: selected.name, short_description: selected.short_description || '', detailed_description: selected.detailed_description || '' });
    setShowRegister(true);
    void pluginService.listInstallerAssets().then((data) => { const list = Array.isArray(data) ? data : []; setInstallerAssets(list); setInstallerAssetId(list[0]?.id || ''); });
  };

  const handleRegister = async () => {
    const existing = plugins.find(plugin => plugin.id === form.plugin_id);
    if (existing && existing.installation_status !== 'not_registered') {
      setShowRegister(false);
      setWizardPlugin(existing);
      return;
    }
    if (!installerAssetId) return;
    setRegistering(true);
    setRegisterError(null);
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    payload.append('installer_asset_id', installerAssetId);
    try {
      const result = await pluginService.register(payload);
      upsertPlugin(result.plugin);
      setShowRegister(false);
      setWizardPlugin(result.plugin);
      setForm(defaultPluginForm);
      setInstallerAssetId('');
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
      const updated = await pluginService.getById(plugin.id);
      upsertPlugin(updated);
      setTab('new');
      if (wizardPlugin?.id === plugin.id) setWizardPlugin(null);
    } catch (error: any) {
      window.alert(error?.response?.data?.detail || 'Unable to remove the plugin.');
    } finally {
      setRemovingPluginId(null);
    }
  };

  const handleRun = async (plugin: SimplePlugin) => {
    setRunningPluginId(plugin.id);
    try {
      const result = await pluginService.test(plugin.id, {});
      const updated = await pluginService.getById(plugin.id);
      upsertPlugin(updated);
      const details = (result.checks || []).map((check: any) => `${check.passed ? '✓' : '✕'} ${check.message}`).join('\n');
      setRunResults((current) => ({ ...current, [plugin.id]: `${result.message}${details ? `\n\n${details}` : ''}` }));
    } catch (error: any) {
      setRunResults((current) => ({ ...current, [plugin.id]: error?.response?.data?.detail || 'Unable to run the connectivity test.' }));
      await loadPlugins();
    } finally {
      setRunningPluginId(null);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Admin Console → Integrations</div><h1 className="mt-2 font-head text-[30px] font-extrabold text-ink">Plugins</h1></div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/plugins/settings')} className="inline-flex items-center gap-2 rounded-xl border border-border-color bg-panel px-4 py-2.5 text-[12.5px] font-bold text-ink cursor-pointer"><Settings className="h-4 w-4" /> Settings</button>
          <button onClick={() => openRegistration()} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-[12.5px] font-bold text-white cursor-pointer"><Plus className="h-4 w-4" /> Add Plugin</button>
        </div>
      </div>

      <div className="mb-6 flex w-fit gap-2 rounded-xl border border-border-color bg-panel p-1.5">
        {(['connected', 'new'] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-4 py-2 text-[12.5px] font-bold cursor-pointer ${tab === value ? 'bg-navy-900 text-white' : 'text-muted'}`}>{value === 'connected' ? 'Connected Plugins' : 'Available Plugins'}</button>)}
      </div>

      {loading ? <div className="rounded-2xl border border-border-color bg-panel p-10 text-center text-[13px] text-muted">Loading plugin catalog…</div> : tab === 'connected' ? <PluginGrid plugins={connectedPlugins} connected onRegister={openRegistration} onSetup={setWizardPlugin} onRun={handleRun} onRemove={handleRemove} runningPluginId={runningPluginId} removingPluginId={removingPluginId} runResults={runResults} /> : <AvailablePluginsPanel count={newPlugins.length} onAdd={() => openRegistration()} />}

      {showRegister && <RegisterPluginDialog plugins={newPlugins} assets={installerAssets} assetId={installerAssetId} setAssetId={setInstallerAssetId} form={form} setForm={setForm} busy={registering} error={registerError} onClose={() => { setShowRegister(false); setRegisterError(null); }} onRegister={handleRegister} />}
      {wizardPlugin && <PluginSetupDialog plugin={wizardPlugin} onClose={() => setWizardPlugin(null)} onUpdated={upsertPlugin} />}
    </div>
  );
};

const PluginGrid: React.FC<{ plugins: SimplePlugin[]; connected: boolean; onRegister: (plugin: SimplePlugin) => void; onSetup: (plugin: SimplePlugin) => void; onRun: (plugin: SimplePlugin) => void; onRemove: (plugin: SimplePlugin) => void; runningPluginId: string | null; removingPluginId: string | null; runResults: Record<string, string> }> = ({ plugins, connected, onRegister, onSetup, onRun, onRemove, runningPluginId, removingPluginId, runResults }) => (
  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
    {plugins.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-border-color bg-panel p-10 text-center text-[13px] text-muted">{connected ? 'No verified connected plugins yet. Use Add Plugin to upload the IIIOT-Veda installer.' : 'No registered plugins are waiting for setup.'}</div> : plugins.map((plugin) => {
      const Icon = iconFor(plugin.name);
      const status = plugin.connection_status === 'idle' ? 'idle' : plugin.connection_status === 'disconnected' ? 'disconnected' : plugin.connection_status === 'connected' ? 'connected' : plugin.installation_status || 'registered';
      return <div key={plugin.id} className="rounded-[18px] border border-border-color bg-panel p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal/10 text-teal"><Icon className="h-5 w-5" /></div><div><div className="font-head text-[18px] font-bold text-ink">{plugin.name}</div><div className="text-[11px] text-muted">v{plugin.version || '1.0.0'}</div></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLOR[status] || STATUS_COLOR.not_configured}`}>{status.replaceAll('_', ' ')}</span></div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">{plugin.short_description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10.5px]"><span className="rounded-full bg-[#EEF6FF] px-2.5 py-1 text-[#0B63E5]">{plugin.category || 'Monitoring'}</span><span className="rounded-full bg-[#F7F3FF] px-2.5 py-1 text-[#7C4DFF]">{targetOsLabel(plugin.target_os)}</span><span className="rounded-full bg-[#F3F7F5] px-2.5 py-1 text-green">{plugin.supported_architectures?.[0] || 'x86_64'}</span></div>
        <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3 text-[11.5px] text-muted"><div className="flex justify-between gap-3"><span>Installer</span><span className="truncate font-semibold text-ink">{brandedFilename(plugin.installer?.filename, 'Upload required')}</span></div><div className="flex justify-between gap-3"><span>Last metric</span><span className="font-semibold text-ink">{plugin.last_metric_received ? formatTelemetryDateTime(plugin.last_metric_received) : 'Awaiting data'}</span></div></div>
        <div className="mt-5 flex gap-2"><button onClick={() => plugin.installation_status === 'not_registered' ? onRegister(plugin) : onSetup(plugin)} className="flex-1 rounded-xl bg-teal px-3 py-2.5 text-[12px] font-bold text-navy-900 cursor-pointer">{connected ? 'Manage Plugin' : plugin.installation_status === 'not_registered' ? 'Register' : 'Setup'}</button>{connected && <button onClick={() => onRun(plugin)} disabled={runningPluginId === plugin.id} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal/30 bg-teal/10 px-3 py-2.5 text-[12px] font-bold text-navy-900 cursor-pointer disabled:cursor-wait disabled:opacity-60" title="Test installation and connectivity"><Activity className={`h-4 w-4 ${runningPluginId === plugin.id ? 'animate-spin' : ''}`} />{runningPluginId === plugin.id ? 'Running…' : 'Run'}</button>}{connected && <button onClick={() => onRemove(plugin)} disabled={removingPluginId === plugin.id} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-bold text-red-600 cursor-pointer hover:bg-red-100 disabled:cursor-wait disabled:opacity-60" title="Remove plugin"><Trash2 className="h-4 w-4" />{removingPluginId === plugin.id ? 'Removing…' : 'Remove'}</button>}</div>
        {runResults[plugin.id] && <div role="status" className="mt-3 whitespace-pre-wrap rounded-xl bg-canvas p-3 text-[11.5px] text-ink">{runResults[plugin.id]}</div>}
      </div>;
    })}
  </div>
);

const AvailablePluginsPanel: React.FC<{ count: number; onAdd: () => void }> = ({ count, onAdd }) => <div className="rounded-2xl border border-dashed border-border-color bg-panel px-6 py-16 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal/10 text-teal"><Plus className="h-6 w-6" /></div><h2 className="mt-4 font-head text-xl font-bold text-ink">Add a plugin</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">Choose from {count} available plugins. Registration, installation-file selection and configuration will happen in the setup flow.</p><button onClick={onAdd} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal px-5 py-3 text-sm font-bold text-navy-900"><Plus className="h-4 w-4" />Add Plugin</button></div>;

const RegisterPluginDialog: React.FC<{ plugins: SimplePlugin[]; assets: InstallerAsset[]; assetId: string; setAssetId: (id: string) => void; form: typeof defaultPluginForm; setForm: React.Dispatch<React.SetStateAction<typeof defaultPluginForm>>; busy: boolean; error: string | null; onClose: () => void; onRegister: () => void }> = ({ plugins, assets, assetId, setAssetId, form, setForm, busy, error, onClose, onRegister }) => {
  const asset = assets.find(item => item.id === assetId);
  const selectedPlugin = plugins.find(item => item.id === form.plugin_id);
  const alreadyRegistered = !!selectedPlugin && selectedPlugin.installation_status !== 'not_registered';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[20px] border border-border-color bg-white p-5 shadow-xl">
    <div className="mb-5 flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Connected Plugins</div><h3 className="mt-1 font-head text-[24px] font-extrabold text-ink">Add IIIOT-Veda Plugin</h3></div><button onClick={onClose} className="rounded-lg border border-border-color p-2 text-muted cursor-pointer"><X className="h-4 w-4" /></button></div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Monitoring plugin"><select value={form.plugin_id} onChange={e => {
        const selected = plugins.find(option => option.id === e.target.value) || plugins[0];
        if (selected) setForm({ ...form, plugin_id: selected.id, name: selected.name, short_description: selected.short_description || '', detailed_description: selected.detailed_description || '' });
      }} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5">{plugins.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></Field>
      <Field label="Plugin name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5 text-ink outline-none transition-colors focus:border-teal focus:ring-2 focus:ring-teal/15" /></Field>
      <Field label="Version"><input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field>
      <Field label="Category"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field>
      {!alreadyRegistered && <Field label="Saved installation file"><select value={assetId} onChange={(e) => { const selected = assets.find(item => item.id === e.target.value); setAssetId(e.target.value); if (selected) setForm(current => ({ ...current, target_os: selected.target_os, architecture: selected.architecture })); }} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5"><option value="">Select from Plugin Settings</option>{assets.map(item => <option key={item.id} value={item.id}>{item.display_name} · {targetOsLabel(item.target_os)} · {item.architecture}</option>)}</select></Field>}
      {!alreadyRegistered && <Field label="Selected target"><div className="rounded-xl border border-border-color bg-canvas px-3 py-2.5 text-ink">{asset ? `${targetOsLabel(asset.target_os)} / ${asset.architecture}` : 'No installation file selected'}</div></Field>}
      <div className="md:col-span-2"><Field label="Short description"><textarea rows={2} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field></div>
      <div className="md:col-span-2"><Field label="Detailed description"><textarea rows={3} value={form.detailed_description} onChange={(e) => setForm({ ...form, detailed_description: e.target.value })} className="w-full rounded-xl border border-border-color bg-canvas px-3 py-2.5" /></Field></div>
      {!alreadyRegistered && !assets.length && <div className="md:col-span-2 rounded-xl bg-amber-tint p-3 text-xs text-[#9A6400]">Add an installation file in Plugin Settings before registering a plugin.</div>}
    </div>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{error}</div>}
    <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl border border-border-color bg-white px-4 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Cancel</button><button onClick={onRegister} disabled={(!alreadyRegistered && !assetId) || busy} className="rounded-xl bg-navy-900 px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer disabled:opacity-50">{busy ? 'Registering…' : alreadyRegistered ? 'Continue Setup' : 'Register Plugin'}</button></div>
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
  const [configs, setConfigs] = useState<Record<string, { enabled: boolean; config: string }>>(plugin.use_case_configs || {});
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    pluginService.getCurrentSystem().then(setSystem).catch(() => setError('Unable to detect the current system.'));
    pluginService.getUseCaseConfig(plugin.id).then((result) => setConfigs(result.configs || {})).catch(() => undefined);
  }, [plugin.id]);

  const saveConfigs = async () => {
    setBusy(true); setError(null); setConfigSaved(false);
    try { await pluginService.saveUseCaseConfig(plugin.id, configs); setConfigSaved(true); setDownloaded(false); onUpdated(await pluginService.getById(plugin.id)); }
    catch (reason: any) { setError(reason?.response?.data?.detail || 'Unable to save use-case configuration.'); }
    finally { setBusy(false); }
  };

  const osMatches = !!system && (plugin.target_os === system.operating_system || (system.operating_system === 'linux' && plugin.target_os?.startsWith('linux-')));
  const packageMatches = !!system && (system.operating_system !== 'linux' || system.supported_package_types.includes(plugin.target_os || ''));
  const architectureMatches = !!system && plugin.supported_architectures?.[0] === system.architecture;
  const compatible = osMatches && packageMatches && architectureMatches;
  const bundleExtension = plugin.target_os === 'windows' ? 'exe' : plugin.target_os === 'linux-deb' ? 'deb' : plugin.target_os === 'linux-rpm' ? 'rpm' : plugin.installer?.filename?.toLowerCase().endsWith('.dmg') ? 'dmg' : 'pkg';
  const pluginKind = plugin.id.replace(/^telegraf-/, '').replace(/^iiiot-veda-/, '').replace(/-monitoring$/, '').replace(/-consumer$/, '');
  const expectedBundleName = `iiiot-veda-${pluginKind}-${plugin.target_os}-${plugin.supported_architectures?.[0]}.${bundleExtension}`;

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
      setMessage('Graphical installer downloaded. Open it, complete the configuration and permission steps, then confirm installation.');
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
      if (!result.success && result.status !== 'idle') {
        const installationFailed = (result.checks || []).some((check: any) => check.name !== 'influxdb_telemetry' && !check.passed);
        setError(result.verification_error
          ? `${installationFailed ? 'Installation verification failed' : 'InfluxDB verification failed'}: ${result.verification_error}`
          : 'No recent plugin data was found in InfluxDB. Start IIIOT-Veda and check its InfluxDB output configuration, then retry.');
      }
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
      <div className="rounded-2xl border border-border-color bg-panel p-4"><div className="space-y-4 text-[12px] text-muted"><SystemDetail label="Plugin" value={plugin.name} /><SystemDetail label="Setup mode" value="Manual" /><SystemDetail label="Target" value={system?.hostname || 'Unknown'} /><SystemDetail label="Target OS" value={targetOsLabel(plugin.target_os)} /><SystemDetail label="Architecture" value={plugin.supported_architectures?.[0] || 'Unknown'} /><SystemDetail label="IIIOT-Veda installer" value={brandedFilename(plugin.installer?.filename)} /><SystemDetail label="Overall plugin bundle" value={brandedFilename(plugin.overall_installer?.filename, expectedBundleName)} /><SystemDetail label="Destination" value="InfluxDB 3" /></div><div className={`mt-5 rounded-xl border p-3 ${compatible ? 'border-green/20 bg-green-tint' : 'border-red-200 bg-red-50'}`}><div className="flex items-center gap-2 text-[12px] font-bold text-ink"><Activity className="h-4 w-4 text-teal" /> Preflight and approval status</div><div className={`mt-2 flex items-center gap-2 text-[11.5px] ${compatible ? 'text-green' : 'text-red-600'}`}><CheckCircle2 className="h-4 w-4" /> {compatible ? 'Administrator approval and host prerequisites are available.' : 'The current machine is not compatible with this plugin bundle.'}</div></div></div>
      {!!Object.keys(configs).length && <div className="mt-5 rounded-2xl border border-border-color bg-panel p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-bold text-ink">Use-case configuration</div><p className="mt-1 text-[11px] text-muted">Set installation defaults now. The graphical installer asks for these settings again, and they remain editable after installation.</p></div><button onClick={() => void saveConfigs()} disabled={busy} className="rounded-lg bg-teal px-3 py-2 text-[11px] font-bold text-navy-900">{configSaved ? 'Saved' : 'Save configuration'}</button></div><div className="mt-3 space-y-3">{Object.entries(configs).map(([kind, item]) => <details key={kind} open className="rounded-xl border border-border-color bg-white p-3"><summary className="cursor-pointer text-[12px] font-bold capitalize text-ink">{kind.replaceAll('-', ' ')}</summary><textarea value={item.config} onChange={(event) => setConfigs(current => ({ ...current, [kind]: { ...item, config: event.target.value } }))} rows={10} className="mt-3 w-full rounded-lg border border-border-color bg-[#0F172A] p-3 font-mono text-[10px] text-slate-100" /></details>)}</div></div>}
      <div className="mt-5 grid gap-3 md:grid-cols-3"><ActionCard number="1" title="Download installer" description="Generate one native installer for this use case and target OS."><button onClick={() => void download()} disabled={!compatible || busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[11.5px] font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" /> {downloaded ? 'Downloaded' : 'Download Installer'}</button></ActionCard><ActionCard number="2" title="Complete setup UI" description="Open the downloaded file and finish configuration, paths and permissions in its setup wizard."><button onClick={() => void confirmInstallation()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[11.5px] font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> {confirmed ? 'Confirmed' : 'Confirm Installation'}</button></ActionCard><ActionCard number="3" title="Verify plugin" description="Verify this use case's data and connect only this plugin."><button onClick={() => void verify()} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-[11.5px] font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><Activity className="h-4 w-4" /> Verify Plugin</button></ActionCard></div>
      {message && <div className="mt-4 rounded-xl bg-blue-tint p-3 text-[12px] text-[#2258b0]">{message}</div>}{error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{error}</div>}
      <div className="mt-6 flex justify-start"><button onClick={() => { setError(null); setStep(0); }} className="rounded-xl border border-border-color bg-white px-5 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Back</button></div>
    </>}
  </div></div>;
};

const SystemDetail: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="flex justify-between gap-3"><span>{label}</span><span className="text-right font-semibold text-ink">{value}</span></div>;
const ActionCard: React.FC<{ number: string; title: string; description: string; children: React.ReactNode }> = ({ number, title, description, children }) => <div className="flex flex-col rounded-2xl border border-border-color bg-panel p-4"><div className="text-[10px] font-bold uppercase text-teal">Step {number}</div><div className="mt-1 font-bold text-ink">{title}</div><p className="mb-4 mt-2 flex-1 text-[11.5px] text-muted">{description}</p>{children}</div>;

export default PluginsPage;
