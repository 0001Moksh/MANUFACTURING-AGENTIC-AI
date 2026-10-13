import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PencilLine, Plus, UploadCloud, X } from 'lucide-react';
import { pluginService } from '../services/api';

interface PluginRecord {
  id: string;
  name: string;
  version?: string;
  category?: string;
  short_description?: string;
  publisher?: string;
  published?: boolean;
  enabled?: boolean;
  added_to_view?: boolean;
  installer?: { status?: string; filename?: string; checksum_sha256?: string; size_bytes?: number };
  versions?: Array<{ version?: string; filename?: string; status?: string; uploaded_at?: string }>;
}

const emptyForm = {
  name: '',
  slug: '',
  version: '1.0.0',
  category: 'Monitoring',
  short_description: '',
  detailed_description: '',
  publisher: 'IIOT Infotech',
  supported_os: 'Windows Server 2019+, Windows 11, Linux',
  supported_architectures: 'x86_64, arm64',
  tags: 'telegraf, cpu, monitoring',
  capabilities: 'cpu.live_metrics, cpu.historical_trends, cpu.threshold_alerts, cpu.agent_analysis',
  use_cases: 'CPU Monitoring, CPU Trends & Analytics, High CPU Alerts, AI-Based CPU Analysis',
};

export const PluginSettingsPage: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await pluginService.list();
        setPlugins(Array.isArray(data) ? data : []);
      } catch {
        setPlugins([]);
      }
    };
    void load();
  }, []);

  const updateStatus = async (pluginId: string, update: Record<string, unknown>) => {
    try {
      const result = await pluginService.setStatus(pluginId, update);
      setPlugins((prev) => prev.map((plugin) => (plugin.id === pluginId ? { ...plugin, ...result?.plugin } : plugin)));
    } catch {
      console.error('Plugin status update failed');
    }
  };

  const registerPlugin = async () => {
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
      added_to_view: false,
    };

    try {
      const result = await pluginService.register(payload);
      setPlugins((prev) => [result?.plugin, ...prev]);
      setShowRegister(false);
      setForm(emptyForm);
    } catch {
      console.error('Unable to register plugin');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-10 max-w-[1200px]">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">Plugin administration</div>
          <h1 className="mt-2 font-head text-[30px] font-extrabold text-ink">Plugin Settings</h1>
        </div>
        <button onClick={() => setShowRegister(true)} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-[12.5px] font-bold text-white cursor-pointer">
          <Plus className="h-4 w-4" />
          Register New Plugin
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="rounded-[18px] border border-border-color bg-panel p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-head text-[18px] font-bold text-ink">{plugin.name}</div>
                <div className="mt-1 text-[11px] text-muted">v{plugin.version || '1.0.0'} · {plugin.category || 'Monitoring'}</div>
              </div>
              <div className="rounded-full bg-[#F4F7FB] px-2.5 py-1 text-[10px] font-bold text-muted">{plugin.published ? 'Published' : 'Draft'}</div>
            </div>

            <p className="mt-4 text-[12.5px] text-muted">{plugin.short_description || 'Plugin metadata is available for registries and catalog visibility.'}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded-full bg-[#EEF6FF] px-2 py-1 text-[#0B63E5]">{plugin.enabled ? 'Enabled' : 'Disabled'}</span>
              <span className="rounded-full bg-[#F4F0FF] px-2 py-1 text-[#7C4DFF]">{plugin.added_to_view ? 'In View' : 'Hidden from View'}</span>
            </div>

            <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3 text-[11px] text-muted">
              <div className="flex items-center justify-between"><span>Publisher</span><span className="font-semibold text-ink">{plugin.publisher || 'MAI Admin'}</span></div>
              <div className="flex items-center justify-between"><span>Installer</span><span className="font-semibold text-ink">{plugin.installer?.filename || 'Not uploaded'}</span></div>
              <div className="flex items-center justify-between"><span>Version history</span><span className="font-semibold text-ink">{plugin.versions?.length || 0}</span></div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="rounded-xl border border-border-color bg-white px-2.5 py-2 text-[11px] font-bold text-ink cursor-pointer"><PencilLine className="mr-1 inline-block h-3.5 w-3.5" />Edit</button>
              <button onClick={() => void updateStatus(plugin.id, { enabled: !(plugin.enabled ?? true) })} className="rounded-xl border border-border-color bg-white px-2.5 py-2 text-[11px] font-bold text-ink cursor-pointer">
                {plugin.enabled ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => void updateStatus(plugin.id, { published: !(plugin.published ?? true) })} className="rounded-xl border border-border-color bg-white px-2.5 py-2 text-[11px] font-bold text-ink cursor-pointer">
                {plugin.published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => void updateStatus(plugin.id, { added_to_view: !(plugin.added_to_view ?? true) })} className="rounded-xl border border-border-color bg-white px-2.5 py-2 text-[11px] font-bold text-ink cursor-pointer">
                {plugin.added_to_view ? 'Remove from View' : 'Add to View'}
              </button>
              <button className="rounded-xl border border-border-color bg-white px-2.5 py-2 text-[11px] font-bold text-ink cursor-pointer col-span-2"><UploadCloud className="mr-1 inline-block h-3.5 w-3.5" />View uploaded installer & versions</button>
            </div>
          </div>
        ))}
      </div>

      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/50 p-4">
          <div className="w-full max-w-2xl rounded-[20px] border border-border-color bg-white p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.5px] text-muted font-bold">General information</div>
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
              <button onClick={() => void registerPlugin()} className="rounded-xl bg-navy-900 px-4 py-2.5 text-[12px] font-bold text-white cursor-pointer">Save plugin</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default PluginSettingsPage;
