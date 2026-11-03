import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileUp, Package, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pluginService } from '../services/api';

type InstallerAsset = { id: string; display_name: string; target_os: string; architecture: string; filename: string; size_bytes: number };
const OS_OPTIONS = [
  { value: 'windows', label: 'Windows (.exe / .msi / .zip)', accept: '.exe,.msi,.zip' },
  { value: 'linux-deb', label: 'Linux Debian/Ubuntu (.deb)', accept: '.deb' },
  { value: 'linux-rpm', label: 'Linux Fedora/RHEL (.rpm)', accept: '.rpm' },
  { value: 'macos', label: 'macOS (.pkg / .dmg)', accept: '.pkg,.dmg' },
];

const getRequestErrorMessage = (reason: any, fallback: string) => {
  const response = reason?.response?.data;
  const detail = response?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.msg === 'string') return item.msg;
      return JSON.stringify(item);
    }).filter(Boolean);
    if (messages.length) return messages.join('; ');
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    return JSON.stringify(detail);
  }
  return response?.message || response?.code || reason?.message || fallback;
};

export const PluginSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<InstallerAsset[]>([]);
  const [name, setName] = useState('');
  const [targetOs, setTargetOs] = useState('linux-rpm');
  const [architecture, setArchitecture] = useState('x86_64');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = () => pluginService.listInstallerAssets().then((data) => setAssets(Array.isArray(data) ? data : [])).catch(() => setAssets([]));
  useEffect(() => { void load(); }, []);
  const upload = async () => {
    if (!file) return;
    setBusy(true); setError('');
    const payload = new FormData();
    payload.append('display_name', name || file.name); payload.append('target_os', targetOs); payload.append('architecture', architecture); payload.append('installer', file);
    try { await pluginService.uploadInstallerAsset(payload); setName(''); setFile(null); await load(); }
    catch (reason: any) { setError(getRequestErrorMessage(reason, 'Unable to save installation file.')); }
    finally { setBusy(false); }
  };
  const remove = async (asset: InstallerAsset) => {
    if (!window.confirm(`Delete ${asset.display_name}?`)) return;
    try { await pluginService.deleteInstallerAsset(asset.id); await load(); }
    catch (reason: any) { window.alert(reason?.response?.data?.detail || 'Unable to delete installation file.'); }
  };
  const selected = OS_OPTIONS.find(option => option.value === targetOs)!;
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1200px] p-6 md:p-10">
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Plugin administration</div><h1 className="mt-2 font-head text-[30px] font-extrabold text-ink">Plugin Settings</h1><p className="mt-2 text-[12.5px] text-muted">Store reusable IIIOT-Veda runtime files once, then select one while registering each plugin.</p></div><button onClick={() => navigate('/plugins')} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-[12.5px] font-bold text-white"><ArrowLeft className="h-4 w-4" />Back to Plugins</button></div>
    <section className="rounded-2xl border border-border-color bg-panel p-5"><div className="flex items-center gap-2 font-head text-xl font-bold text-ink"><FileUp className="text-teal" />Add installation file</div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-ink">Display name<input value={name} onChange={event => setName(event.target.value)} placeholder="Fedora x86_64 runtime" className="mt-2 w-full rounded-xl border border-border-color bg-canvas p-3 font-normal" /></label><label className="text-xs font-bold text-ink">Operating system<select value={targetOs} onChange={event => { setTargetOs(event.target.value); setFile(null); }} className="mt-2 w-full rounded-xl border border-border-color bg-canvas p-3 font-normal">{OS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs font-bold text-ink">Architecture<select value={architecture} onChange={event => setArchitecture(event.target.value)} className="mt-2 w-full rounded-xl border border-border-color bg-canvas p-3 font-normal"><option value="x86_64">x86_64</option><option value="arm64">arm64</option></select></label><label className="text-xs font-bold text-ink">Installation file<input key={targetOs} type="file" accept={selected.accept} onChange={event => setFile(event.target.files?.[0] || null)} className="mt-2 w-full rounded-xl border border-border-color bg-canvas p-2.5 font-normal" /></label></div>{error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</div>}<button onClick={() => void upload()} disabled={!file || busy} className="mt-5 rounded-xl bg-teal px-5 py-2.5 text-xs font-bold text-navy-900 disabled:opacity-50">{busy ? 'Saving…' : 'Save installation file'}</button></section>
    <section className="mt-6"><h2 className="font-head text-xl font-bold text-ink">Saved installation files</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assets.map(asset => <div key={asset.id} className="rounded-2xl border border-border-color bg-panel p-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-teal/10 p-3 text-teal"><Package size={20} /></div><div><div className="font-bold text-ink">{asset.display_name}</div><div className="mt-1 text-xs text-muted">{asset.filename}</div></div></div><button onClick={() => void remove(asset)} className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600"><Trash2 size={16} /></button></div><div className="mt-4 space-y-2 text-xs text-muted"><div className="flex justify-between"><span>Target</span><strong className="text-ink">{OS_OPTIONS.find(option => option.value === asset.target_os)?.label || asset.target_os}</strong></div><div className="flex justify-between"><span>Architecture</span><strong className="text-ink">{asset.architecture}</strong></div><div className="flex justify-between"><span>Size</span><strong className="text-ink">{(asset.size_bytes / 1024 / 1024).toFixed(1)} MB</strong></div></div></div>)}{!assets.length && <div className="col-span-full rounded-2xl border border-dashed border-border-color p-8 text-center text-sm text-muted">No installation files saved yet.</div>}</div></section>
  </motion.div>;
};
export default PluginSettingsPage;
