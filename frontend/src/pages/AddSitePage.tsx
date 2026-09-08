import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const emptyForm = {
  name: '',
  location: '',
  description: '',
  status: 'Active',
};

export const AddSitePage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        status: form.status,
      };

      if (!payload.name || !payload.location) {
        throw new Error('Site name and location are required.');
      }

      await api.post('/admin/sites', payload);
      navigate('/admin?pane=sites');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to create site. Please review the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Admin Console</div>
          <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">Add new site</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin?pane=sites')}
          className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer"
        >
          Back to Sites
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel border border-border-color rounded-[14px] p-5">
        {error && (
          <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Site / Plant Name</label>
            <input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Location</label>
            <input
              value={form.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal"
              placeholder="Address / City"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal"
            >
              <option value="Active">Active</option>
              <option value="Live">Live</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin?pane=sites')} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer disabled:opacity-60">
            {saving ? 'Creating...' : 'Create Site'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSitePage;
