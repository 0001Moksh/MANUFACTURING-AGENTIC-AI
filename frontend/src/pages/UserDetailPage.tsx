import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';

export const UserDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/rbac/users');
        const found = Array.isArray(response.data) ? response.data.find((item: any) => String(item.id) === String(id)) : null;
        setUser(found ?? { id, name: 'User', username: 'unknown', role: 'Viewer / Auditor', status: 'ACTIVE', site: 'Platform', permissions: [] });
      } catch {
        setUser({ id, name: 'User', username: 'unknown', role: 'Viewer / Auditor', status: 'ACTIVE', site: 'Platform', permissions: [] });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  if (loading) {
    return <div className="p-6 text-[13px] text-muted">Loading user profile…</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/admin?pane=users&tab=users')} className="rounded-[10px] border border-border-color bg-white p-2 text-ink cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">Access profile</div>
            <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">{user.name || user.username}</h2>
          </div>
        </div>
        <button type="button" onClick={() => navigate(`/admin/users/${id}/edit`)} className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer">Edit</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-panel border border-border-color rounded-[14px] p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-muted uppercase tracking-[0.5px]"><Eye className="h-4 w-4" />Identity</div>
          <div className="space-y-3 text-[13px]">
            <div><span className="block text-faint text-[10.5px] uppercase">Username</span><span className="font-bold text-ink">{user.username}</span></div>
            <div><span className="block text-faint text-[10.5px] uppercase">Email</span><span className="font-bold text-ink">{user.email || 'Not provided'}</span></div>
            <div><span className="block text-faint text-[10.5px] uppercase">Role</span><span className="font-bold text-ink">{user.role}</span></div>
            <div><span className="block text-faint text-[10.5px] uppercase">Status</span><span className="font-bold text-ink">{user.status}</span></div>
          </div>
        </div>

        <div className="bg-panel border border-border-color rounded-[14px] p-4">
          <div className="mb-3 text-[12px] font-bold text-muted uppercase tracking-[0.5px]">Scope & permissions</div>
          <div className="space-y-3 text-[13px]">
            <div><span className="block text-faint text-[10.5px] uppercase">Scope</span><span className="font-bold text-ink">{user.scope?.value || user.site || 'Platform'}</span></div>
            <div><span className="block text-faint text-[10.5px] uppercase">Permissions</span><span className="font-bold text-ink">{user.permissions?.length ? user.permissions.slice(0, 6).join(', ') : 'No explicit permissions assigned'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
