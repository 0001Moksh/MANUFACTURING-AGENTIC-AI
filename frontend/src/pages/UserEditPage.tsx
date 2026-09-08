import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';

export const UserEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<string[]>(['Viewer / Auditor', 'Super Admin', 'Operations Head']);
  const [sites, setSites] = useState<string[]>(['Alpha Refinery', 'Beta Offshore Platform', 'Gamma Gas Processing']);
  const [form, setForm] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    department: '',
    role: 'Viewer / Auditor',
    site: 'Alpha Refinery',
    status: 'ACTIVE',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [rolesResponse, sitesResponse, usersResponse] = await Promise.all([
          api.get('/rbac/roles'),
          api.get('/sites'),
          api.get('/rbac/users'),
        ]);

        const roleNames = Array.isArray(rolesResponse.data) ? rolesResponse.data.map((role: any) => role.name).filter(Boolean) : [];
        const siteNames = Array.isArray(sitesResponse.data) ? sitesResponse.data.map((site: any) => site.name).filter(Boolean) : [];
        setRoles(roleNames.length ? roleNames : roles);
        setSites(siteNames.length ? siteNames : sites);

        const found = Array.isArray(usersResponse.data) ? usersResponse.data.find((item: any) => String(item.id) === String(id)) : null;
        if (found) {
          setForm({
            employee_id: found.employee_id || found.employeeId || '',
            full_name: found.full_name || found.name || found.username || '',
            email: found.email || '',
            department: found.department || '',
            role: found.role || 'Viewer / Auditor',
            site: found.site || siteNames[0] || 'Alpha Refinery',
            status: found.status || 'ACTIVE',
          });
        }
      } catch {
        // no-op: page still renders with defaults for local admin flow
      }
    };

    void load();
  }, [id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.put(`/api/rbac/users/${id}`, {
        employee_id: form.employee_id,
        full_name: form.full_name,
        email: form.email,
        department: form.department,
        role: form.role,
        site: form.site,
        status: form.status,
      });
      navigate(`/admin/users/${id}`);
    } catch (error) {
      console.error('Failed to update user:', error);
      window.alert('Unable to save user updates right now.');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Admin Console</div>
          <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">Edit user</h2>
        </div>
        <button type="button" onClick={() => navigate(`/admin/users/${id}`)} className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Back to profile</button>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel border border-border-color rounded-[14px] p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Employee ID</label>
            <input value={form.employee_id} onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Full Name</label>
            <input value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Department</label>
            <input value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Role</label>
            <select value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal">
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Site</label>
            <select value={form.site} onChange={(e) => setForm((prev) => ({ ...prev, site: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal" required>
              {sites.map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Status</label>
            <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal">
              <option value="INVITED">INVITED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DISABLED">DISABLED</option>
              <option value="LOCKED">LOCKED</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => navigate(`/admin/users/${id}`)} className="rounded-[10px] border border-border-color bg-white px-4 py-2 text-[12px] font-bold text-ink cursor-pointer">Cancel</button>
          <button type="submit" className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer">Save changes</button>
        </div>
      </form>
    </div>
  );
};
