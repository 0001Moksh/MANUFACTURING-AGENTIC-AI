import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const defaultForm = {
  employee_id: '',
  full_name: '',
  email: '',
  password: '',
  department: '',
  site: 'Alpha Refinery',
  role: 'Viewer / Auditor',
  status: 'INVITED',
};

export const AddUserPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(defaultForm);
  const [roles, setRoles] = useState<string[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await api.get('/rbac/roles');
        const names = Array.isArray(response.data) ? response.data.map((role: any) => role.name).filter(Boolean) : [];
        setRoles(names.length ? names : ['Viewer / Auditor', 'Super Admin', 'Operations Head']);
        setForm((prev) => ({ ...prev, role: prev.role || (names[0] ?? 'Viewer / Auditor') }));
      } catch {
        setRoles(['Viewer / Auditor', 'Super Admin', 'Operations Head']);
      } finally {
        setLoading(false);
      }
    };

    const loadSites = async () => {
      try {
        const response = await api.get('/sites');
        const names = Array.isArray(response.data) ? response.data.map((site: any) => site.name).filter(Boolean) : [];
        setSites(names.length ? names : ['Alpha Refinery', 'Beta Offshore Platform', 'Gamma Gas Processing']);
        setForm((prev) => ({ ...prev, site: prev.site || (names[0] ?? 'Alpha Refinery') }));
      } catch {
        setSites(['Alpha Refinery', 'Beta Offshore Platform', 'Gamma Gas Processing']);
      }
    };

    void loadRoles();
    void loadSites();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        employeeId: form.employee_id.trim(),
        fullName: form.full_name.trim(),
        email: form.email.trim(),
        temporaryPassword: form.password.trim(),
        password: form.password.trim(),
        department: form.department.trim(),
        site: form.site.trim() || 'Alpha Refinery',
        role: form.role || 'Viewer / Auditor',
        status: form.status || 'INVITED',
        identity_provider: 'Local',
      };

      if (!payload.employeeId || !payload.fullName || !payload.email || !payload.department || !payload.temporaryPassword) {
        throw new Error('Employee ID, full name, email, department, and temporary password are required.');
      }

      await api.post('/rbac/users', payload);
      navigate('/admin?pane=users&tab=users');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to create user. Please review the form and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Admin Console</div>
          <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">Add new user</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin?pane=users&tab=users')}
          className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer"
        >
          Back to Users
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
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Employee ID</label>
            <input value={form.employee_id} onChange={(e) => handleChange('employee_id', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Full Name</label>
            <input value={form.full_name} onChange={(e) => handleChange('full_name', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Email Address</label>
            <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Temporary Password</label>
            <input type="text" value={form.password} onChange={(e) => handleChange('password', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Department</label>
            <input value={form.department} onChange={(e) => handleChange('department', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Site / Plant</label>
            <select value={form.site} onChange={(e) => handleChange('site', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" disabled={loading} required>
              {sites.map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Role</label>
            <select value={form.role} onChange={(e) => handleChange('role', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" disabled={loading} required>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Status</label>
            <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required>
              <option value="INVITED">INVITED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DISABLED">DISABLED</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/admin?pane=users&tab=users')} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer disabled:opacity-60">
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
};
