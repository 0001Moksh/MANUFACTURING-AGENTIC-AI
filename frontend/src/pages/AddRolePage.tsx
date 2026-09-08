import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PermissionBuilder from '../components/admin/PermissionBuilder';
import type { BuilderPermissionRule } from '../components/admin/PermissionBuilder';
import { api } from '../services/api';

type ScopeLevel = 'GLOBAL' | 'PLANT';

type SiteOption = { id: number; name: string; code?: string; region?: string };

export const AddRolePage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>('GLOBAL');
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([]);
  const [permissions, setPermissions] = useState<BuilderPermissionRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSites = async () => {
      try {
        const response = await api.get('/admin/sites');
        const sites = Array.isArray(response.data) ? response.data : [];
        setSiteOptions(sites.map((site: any) => ({ id: Number(site.id), name: site.name || site.site_name || `Site ${site.id}`, code: site.code || '', region: site.region || '' })));
      } catch {
        setSiteOptions([]);
      }
    };
    void loadSites();
  }, []);

  const buildScope = () => {
    switch (scopeLevel) {
      case 'PLANT':
        return { type: 'Plant', plant_ids: selectedPlantIds };
      case 'GLOBAL':
      default:
        return { type: 'Global', level: 'Global' };
    }
  };

  const togglePlant = (siteId: number) => {
    setSelectedPlantIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (permissions.length === 0) {
      setError('Add at least one permission rule before creating the role.');
      setSaving(false);
      return;
    }

    try {
      await api.post('/rbac/roles', {
        name: name.trim(),
        description: description.trim(),
        status,
        scope_bounds: buildScope(),
        permissions: permissions.map((permission) => ({
          module_key: permission.module_key,
          resource_key: permission.resource_key,
          access_types: permission.actions,
        })),
      });
      navigate('/admin?pane=users&tab=roles');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to create role. Please check the input and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Admin Console</div>
          <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">Create role</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin?pane=users&tab=roles')}
          className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer"
        >
          Back to Roles
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel border border-border-color rounded-[14px] p-5">
        {error && (
          <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Role name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Scope ceiling</label>
            <select value={scopeLevel} onChange={(e) => setScopeLevel(e.target.value as ScopeLevel)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal">
              <option value="GLOBAL">Global</option>
              <option value="PLANT">Plant</option>
            </select>
          </div>
        </div>

        {scopeLevel === 'PLANT' && (
          <div className="mt-4 rounded-[10px] border border-dashed border-border-color bg-white p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Plant scope</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {siteOptions.length > 0 ? siteOptions.map((site) => (
                <label key={site.id} className="flex items-center gap-2 rounded-[8px] border border-border-color bg-panel px-2.5 py-2 text-[12px] text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlantIds.includes(site.id)}
                    onChange={() => togglePlant(site.id)}
                    className="rounded border-border-color text-teal focus:ring-teal/20"
                  />
                  <span>{site.name}</span>
                  {site.code && <span className="text-muted">({site.code})</span>}
                </label>
              )) : <div className="text-[12px] text-muted">No active plants available for scope assignment.</div>}
            </div>
          </div>
        )}

        <PermissionBuilder value={permissions} onChange={setPermissions} />

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin?pane=users&tab=roles')} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer disabled:opacity-60">
            {saving ? 'Creating...' : 'Create Role'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddRolePage;