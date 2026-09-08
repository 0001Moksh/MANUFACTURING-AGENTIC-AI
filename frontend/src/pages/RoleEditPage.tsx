import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PermissionBuilder, { parsePermissionValue } from '../components/admin/PermissionBuilder';
import type { BuilderPermissionRule } from '../components/admin/PermissionBuilder';
import { api } from '../services/api';

type ScopeLevel = 'GLOBAL' | 'PLANT';
type SiteOption = { id: number; name: string; code?: string };

export const RoleEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    status: 'ACTIVE',
    description: '',
  });
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>('GLOBAL');
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([]);
  const [permissions, setPermissions] = useState<BuilderPermissionRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [rolesResponse, sitesResponse] = await Promise.all([
          api.get('/rbac/roles'),
          api.get('/admin/sites')
        ]);

        const sites = Array.isArray(sitesResponse.data) ? sitesResponse.data : [];
        setSiteOptions(sites.map((site: any) => ({ id: Number(site.id), name: site.name || site.site_name || `Site ${site.id}`, code: site.code || '' })));

        const found = Array.isArray(rolesResponse.data) ? rolesResponse.data.find((item: any) => String(item.id) === String(id)) : null;
        if (found) {
          const nextPermissions = (found.permissions || [])
            .map((permission: string) => parsePermissionValue(permission))
            .filter(Boolean) as BuilderPermissionRule[];

          const scope = found.scope || found.scope_bounds || { type: 'Global', level: 'Global' };
          const plantIds = Array.isArray(scope.plant_ids)
            ? scope.plant_ids
                .map((siteId: number | string) => Number(siteId))
                .filter((value: number) => !Number.isNaN(value))
            : [];

          setForm({
            name: found.name || '',
            status: found.status || 'ACTIVE',
            description: found.description || '',
          });
          setScopeLevel(scope.type === 'Plant' ? 'PLANT' : 'GLOBAL');
          setSelectedPlantIds(plantIds);
          setPermissions(nextPermissions);
        }
      } catch {
        setError('Unable to load the role details.');
      }
    };

    void load();
  }, [id]);

  const buildScope = () => {
    if (scopeLevel === 'PLANT') {
      return { type: 'Plant', plant_ids: selectedPlantIds };
    }
    return { type: 'Global', level: 'Global' };
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

    try {
      await api.patch(`/rbac/roles/${id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        scope_bounds: buildScope(),
        permissions: permissions.map((permission) => ({
          module_key: permission.module_key,
          resource_key: permission.resource_key,
          access_types: permission.actions,
        })),
      });
      navigate(`/admin/roles/${id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to save the role. Please check the input and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Admin Console</div>
          <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">Edit role</h2>
        </div>
        <button type="button" onClick={() => navigate(`/admin/roles/${id}`)} className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Back to role</button>
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
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Status</label>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DRAFT">DRAFT</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" />
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
          <button type="button" onClick={() => navigate(`/admin/roles/${id}`)} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer disabled:opacity-60">{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
};
