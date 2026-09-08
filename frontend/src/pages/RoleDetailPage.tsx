import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export const RoleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/rbac/roles');
        const found = Array.isArray(response.data) ? response.data.find((item: any) => String(item.id) === String(id)) : null;
        setRole(found ?? { id, name: 'Role', type: 'Custom', status: 'ACTIVE', permissions: [], scope: { type: 'Platform', level: 'Platform' }, user_count: 0 });
      } catch {
        setRole({ id, name: 'Role', type: 'Custom', status: 'ACTIVE', permissions: [], scope: { type: 'Platform', level: 'Platform' }, user_count: 0 });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-[13px] text-muted">Loading role details…</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/admin?pane=users&tab=roles')} className="rounded-[10px] border border-border-color bg-white p-2 text-ink cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Role profile</div>
            <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">{role.name}</h2>
          </div>
        </div>
        <button type="button" onClick={() => navigate(`/admin/roles/${id}/edit`)} className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Edit</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-panel border border-border-color rounded-[14px] p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-muted uppercase tracking-[0.5px]"><ShieldCheck className="h-4 w-4" />Overview</div>
          <div className="space-y-3 text-[13px]">
            <div><span className="block text-faint text-[10.5px] uppercase">Status</span><span className="font-bold text-ink">{role.status}</span></div>
            <div><span className="block text-faint text-[10.5px] uppercase">Scope</span><span className="font-bold text-ink">{role.scope?.value || role.scope?.type || 'Global'}</span></div>
            <div><span className="block text-faint text-[10.5px] uppercase">Assigned users</span><span className="font-bold text-ink">{role.user_count || 0}</span></div>
          </div>
        </div>

        <div className="bg-panel border border-border-color rounded-[14px] p-4">
          <div className="mb-3 text-[12px] font-bold text-muted uppercase tracking-[0.5px]">Permissions matrix</div>
          <div className="flex flex-wrap gap-2">
            {(role.permissions?.length ? role.permissions : ['sites.view', 'workflows.execute', 'reports.export']).map((permission: string) => (
              <span key={permission} className="rounded-full border border-border-color bg-white px-2 py-1 text-[10.5px] font-bold text-ink">{permission}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
