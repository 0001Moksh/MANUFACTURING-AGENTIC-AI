import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pluginService } from '../services/api';

interface PluginRecord {
  id: string;
  name: string;
  version?: string;
  category?: string;
  short_description?: string;
  target_os?: string;
  supported_architectures?: string[];
  installation_status?: string;
  connection_status?: string;
  installer?: { filename?: string; checksum_sha256?: string; size_bytes?: number; status?: string };
  overall_installer?: { filename?: string; checksum_sha256?: string; size_bytes?: number; status?: string };
}

const OS_LABELS: Record<string, string> = {
  windows: 'Windows (.exe / .msi / .zip)',
  'linux-deb': 'Linux (.deb)',
  'linux-rpm': 'Linux (.rpm)',
  'linux-archive': 'Linux (.tar.gz / .tgz)',
  macos: 'macOS (.pkg / .dmg / archive)',
};

export const PluginSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);

  useEffect(() => {
    pluginService.list().then((data) => setPlugins(Array.isArray(data) ? data : [])).catch(() => setPlugins([]));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1200px] p-6 md:p-10">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted">Plugin administration</div><h1 className="mt-2 font-head text-[30px] font-extrabold text-ink">Plugin Settings</h1><p className="mt-2 text-[12.5px] text-muted">MAI currently supports only Telegraf CPU Monitoring.</p></div>
        <button onClick={() => navigate('/plugins')} className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-[12.5px] font-bold text-white cursor-pointer"><ArrowLeft className="h-4 w-4" /> Back to Plugins</button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="rounded-[18px] border border-border-color bg-panel p-5 shadow-sm">
            <div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal/10 text-teal"><Cpu className="h-5 w-5" /></div><div><div className="font-head text-[18px] font-bold text-ink">{plugin.name}</div><div className="mt-1 text-[11px] text-muted">v{plugin.version || '1.0.0'} · {plugin.category || 'Monitoring'}</div></div></div>
            <p className="mt-4 text-[12.5px] text-muted">{plugin.short_description}</p>
            <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3 text-[11px] text-muted">
              <div className="flex justify-between gap-3"><span>Target OS</span><span className="text-right font-semibold text-ink">{OS_LABELS[plugin.target_os || ''] || plugin.target_os || 'Select during registration'}</span></div>
              <div className="flex justify-between gap-3"><span>Architecture</span><span className="font-semibold text-ink">{plugin.supported_architectures?.[0] || 'Select during registration'}</span></div>
              <div className="flex justify-between gap-3"><span>Telegraf installer</span><span className="truncate font-semibold text-ink">{plugin.installer?.filename || 'Not uploaded'}</span></div>
              <div className="flex justify-between gap-3"><span>Overall bundle</span><span className="truncate font-semibold text-ink">{plugin.overall_installer?.filename || 'Not generated'}</span></div>
              <div className="flex justify-between gap-3"><span>Status</span><span className="font-semibold text-ink">{plugin.connection_status === 'connected' ? 'Connected' : plugin.installation_status?.replaceAll('_', ' ') || 'Not registered'}</span></div>
            </div>
            <button onClick={() => navigate('/plugins')} className="mt-5 w-full rounded-xl border border-border-color bg-white px-3 py-2.5 text-[12px] font-bold text-ink cursor-pointer">Manage registration and setup</button>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PluginSettingsPage;
