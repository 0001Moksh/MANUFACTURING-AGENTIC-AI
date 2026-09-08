import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, PencilLine, Trash2, Search, Plus, Filter } from 'lucide-react';
import { api } from '../../services/api';

type TableTab = 'users' | 'roles';

interface UsersTableProps {
  defaultTab?: TableTab;
}

const statusClasses: Record<string, string> = {
  ACTIVE: 'bg-green-tint text-green',
  INVITED: 'bg-blue-tint text-[#2258b0]',
  SUSPENDED: 'bg-amber-tint text-[#9A6400]',
  DISABLED: 'bg-[#EEF0F5] text-muted',
  LOCKED: 'bg-red-50 text-red-600',
  DRAFT: 'bg-[#EEF0F5] text-muted',
  INACTIVE: 'bg-[#EEF0F5] text-muted',
};

const ALL = 'ALL';

const initialsOf = (label: string) =>
  label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const avatarPalette = ['bg-teal/15 text-teal', 'bg-[#EAF1FF] text-[#2258b0]', 'bg-amber-tint text-[#9A6400]', 'bg-[#F1E9FF] text-[#6B3FD1]'];

const colorFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % avatarPalette.length;
  return avatarPalette[Math.abs(hash)];
};

/* ------------------------------------------------------------------ */
/* Reusable filterable column header                                   */
/* ------------------------------------------------------------------ */

interface ColumnFilterHeaderProps {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  align?: 'left' | 'right';
}

const ColumnFilterHeader: React.FC<ColumnFilterHeaderProps> = ({ label, options, value, onChange, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const isActive = value !== ALL;

  return (
    <th className={`relative text-${align} text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]`}>
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <span>{label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`rounded-[4px] p-0.5 cursor-pointer normal-case ${isActive ? 'text-teal' : 'text-faint hover:text-ink'}`}
          aria-label={`Filter ${label}`}
        >
          <Filter className="h-3 w-3" fill={isActive ? 'currentColor' : 'none'} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute top-[calc(100%+4px)] z-20 max-h-[220px] w-[170px] overflow-y-auto rounded-[8px] border border-border-color bg-white p-1 shadow-lg normal-case ${align === 'right' ? 'right-0' : 'left-0'}`}>
            <button
              type="button"
              onClick={() => { onChange(ALL); setOpen(false); }}
              className={`w-full rounded-[6px] px-2 py-1.5 text-left text-[11px] font-medium cursor-pointer ${value === ALL ? 'bg-teal/10 text-teal' : 'text-ink hover:bg-panel'}`}
            >
              All
            </button>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => { onChange(option); setOpen(false); }}
                className={`w-full truncate rounded-[6px] px-2 py-1.5 text-left text-[11px] font-medium cursor-pointer ${value === option ? 'bg-teal/10 text-teal' : 'text-ink hover:bg-panel'}`}
                title={option}
              >
                {option}
              </button>
            ))}
            {options.length === 0 && <div className="px-2 py-1.5 text-[11px] text-muted">No values</div>}
          </div>
        </>
      )}
    </th>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export const UsersTable: React.FC<UsersTableProps> = ({ defaultTab = 'users' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TableTab>(defaultTab);
  const [search, setSearch] = useState('');

  const [userFilters, setUserFilters] = useState({ role: ALL, scope: ALL, status: ALL });
  const [roleFilters, setRoleFilters] = useState({ type: ALL, scope: ALL, members: ALL, status: ALL });

  const loadData = async () => {
    try {
      const [rolesResponse, usersResponse] = await Promise.all([
        api.get('/rbac/roles').catch(() => ({ data: [] })),
        api.get('/rbac/users').catch(() => ({ data: [] })),
      ]);
      setRoles(Array.isArray(rolesResponse.data) ? rolesResponse.data : []);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch {
      setRoles([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (requestedTab === 'roles') {
      setActiveTab('roles');
      return;
    }
    if (requestedTab === 'users') {
      setActiveTab('users');
      return;
    }
    setActiveTab(defaultTab);
  }, [defaultTab, location.search]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setSearch('');
    setUserFilters({ role: ALL, scope: ALL, status: ALL });
    setRoleFilters({ type: ALL, scope: ALL, members: ALL, status: ALL });
  }, [activeTab]);

  const applyTab = (nextTab: TableTab) => {
    setActiveTab(nextTab);
    const params = new URLSearchParams(location.search);
    params.set('pane', 'users');
    params.set('tab', nextTab);
    navigate({ pathname: '/admin', search: `?${params.toString()}` });
  };

  const handleDeleteUser = async (user: any) => {
    const confirmed = window.confirm(`Deactivate or delete ${user.name || user.username}? This action is irreversible for the current RBAC mapping.`);
    if (!confirmed) return;

    try {
      await api.delete(`/rbac/users/${user.id}`);
      await loadData();
    } catch {
      window.alert('Unable to delete this user right now.');
    }
  };

  const handleDeleteRole = async (role: any) => {
    const confirmed = window.confirm(`Delete role ${role.name}? This will remove the role mapping and permissions from the platform.`);
    if (!confirmed) return;

    try {
      await api.delete(`/rbac/roles/${role.id}`);
      await loadData();
    } catch {
      window.alert('Unable to delete this role right now.');
    }
  };

  /* ------------------------ derived display fields ------------------------ */

  const usersWithDerived = useMemo(
    () =>
      users.map((user) => ({
        raw: user,
        displayName: user.name || user.username || 'Unnamed user',
        roleList: user.assigned_roles?.length ? user.assigned_roles.map((r: any) => r.name).join(', ') : user.role || '—',
        scopeValue: user.scope?.value || user.site || 'Platform',
        status: user.status || 'ACTIVE',
        permissionSummary: user.permissions?.slice(0, 3).join(', ') || 'No explicit permissions',
      })),
    [users]
  );

  const rolesWithDerived = useMemo(
    () =>
      roles.map((role) => ({
        raw: role,
        type: role.type || 'Custom',
        scopeValue: role.scope?.value || role.scope?.type || 'Platform',
        members: String(role.user_count ?? 0),
        status: role.status || 'ACTIVE',
      })),
    [roles]
  );

  const uniqueValues = (list: string[]) => Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));

  const userRoleOptions = useMemo(() => uniqueValues(usersWithDerived.map((u) => u.roleList)), [usersWithDerived]);
  const userScopeOptions = useMemo(() => uniqueValues(usersWithDerived.map((u) => u.scopeValue)), [usersWithDerived]);
  const userStatusOptions = useMemo(() => uniqueValues(usersWithDerived.map((u) => u.status)), [usersWithDerived]);

  const roleTypeOptions = useMemo(() => uniqueValues(rolesWithDerived.map((r) => r.type)), [rolesWithDerived]);
  const roleScopeOptions = useMemo(() => uniqueValues(rolesWithDerived.map((r) => r.scopeValue)), [rolesWithDerived]);
  const roleMembersOptions = useMemo(() => uniqueValues(rolesWithDerived.map((r) => r.members)), [rolesWithDerived]);
  const roleStatusOptions = useMemo(() => uniqueValues(rolesWithDerived.map((r) => r.status)), [rolesWithDerived]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return usersWithDerived.filter((user) => {
      if (userFilters.role !== ALL && user.roleList !== userFilters.role) return false;
      if (userFilters.scope !== ALL && user.scopeValue !== userFilters.scope) return false;
      if (userFilters.status !== ALL && user.status !== userFilters.status) return false;
      if (!query) return true;
      const haystack = `${user.displayName} ${user.raw.username || ''} ${user.raw.email || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [usersWithDerived, search, userFilters]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rolesWithDerived.filter((role) => {
      if (roleFilters.type !== ALL && role.type !== roleFilters.type) return false;
      if (roleFilters.scope !== ALL && role.scopeValue !== roleFilters.scope) return false;
      if (roleFilters.members !== ALL && role.members !== roleFilters.members) return false;
      if (roleFilters.status !== ALL && role.status !== roleFilters.status) return false;
      if (!query) return true;
      return `${role.raw.name || ''} ${role.raw.description || ''}`.toLowerCase().includes(query);
    });
  }, [rolesWithDerived, search, roleFilters]);

  const activeFilterCount = activeTab === 'users'
    ? Object.values(userFilters).filter((v) => v !== ALL).length
    : Object.values(roleFilters).filter((v) => v !== ALL).length;

  return (
    <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden">
      {/* Tabs (with inline quick-add) + search */}
      <div className="flex flex-col gap-3 px-[16px] py-[12px] border-b border-border-color bg-white md:flex-row md:items-center md:justify-between">
        <div className="inline-flex w-fit items-center rounded-[10px] border border-border-color bg-[#F4F7FB] p-[2px]">
          {/* USERS TAB */}
          <div
            className={`relative overflow-hidden inline-flex items-center gap-2 rounded-[8px] pl-3 text-[11px] font-bold transition-colors ${activeTab === 'users' ? 'bg-white border border-black text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
          >
            <span
              onClick={() => applyTab('users')}
              className="inline-flex cursor-pointer items-center py-1.5 pr-1"
            >
              Users
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate('/admin/users/create');
              }}
              title="Add user"
              aria-label="Add user"
              className="self-stretch flex items-center justify-center px-2.5 border-l border-border-color/60 bg-teal/10 text-teal hover:bg-teal hover:text-white cursor-pointer transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* ROLES TAB */}
          <div
            className={`relative overflow-hidden inline-flex items-center gap-2 rounded-[8px] pl-3 text-[11px] font-bold transition-colors ${activeTab === 'roles' ? 'bg-white border border-black text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
          >
            <span
              onClick={() => applyTab('roles')}
              className="inline-flex cursor-pointer items-center py-1.5 pr-1"
            >
              Roles
            </span>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate('/admin/roles/create');
              }}
              title="Add role"
              aria-label="Add role"
              className="self-stretch flex items-center justify-center px-2.5 border-l border-border-color/60 bg-teal/10 text-teal hover:bg-teal hover:text-white cursor-pointer transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => (activeTab === 'users' ? setUserFilters({ role: ALL, scope: ALL, status: ALL }) : setRoleFilters({ type: ALL, scope: ALL, members: ALL, status: ALL }))}
              className="rounded-[8px] border border-border-color bg-white px-2.5 py-1.5 text-[10.5px] font-bold text-muted cursor-pointer hover:text-ink"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
          <div className="relative w-full md:w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={activeTab === 'users' ? 'Search users...' : 'Search roles...'}
              className="w-full rounded-[8px] border border-border-color bg-white py-1.5 pl-8 pr-3 text-[12px] text-ink focus:outline-none focus:border-teal"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-[12px] text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-color border-t-teal" />
          Loading RBAC data…
        </div>
      ) : activeTab === 'users' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Name</th>
                <ColumnFilterHeader label="Role" options={userRoleOptions} value={userFilters.role} onChange={(v) => setUserFilters((f) => ({ ...f, role: v }))} />
                <ColumnFilterHeader label="Scope" options={userScopeOptions} value={userFilters.scope} onChange={(v) => setUserFilters((f) => ({ ...f, scope: v }))} />
                <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Permissions</th>
                <ColumnFilterHeader label="Status" options={userStatusOptions} value={userFilters.status} onChange={(v) => setUserFilters((f) => ({ ...f, status: v }))} />
                <th className="text-right text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-[28px_16px] text-center">
                    <div className="text-[12px] font-bold text-ink">{search || activeFilterCount > 0 ? 'No users match your filters.' : 'No RBAC users are currently mapped.'}</div>
                    {!search && activeFilterCount === 0 && <div className="mt-1 text-[11.5px] text-muted">Add a user to get started with access control.</div>}
                  </td>
                </tr>
              ) : (
                filteredUsers.map(({ raw: user, displayName, roleList, scopeValue, status, permissionSummary }) => (
                  <tr key={user.id} className="border-b border-[#F0F2F7] last:border-b-0 hover:bg-[#FBFCFE] transition-colors">
                    <td className="p-[12px_16px] align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${colorFor(displayName)}`}>
                          {initialsOf(displayName)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-ink">{displayName}</div>
                          <div className="truncate text-[11.5px] text-muted">{user.email || user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-[12px_16px] align-middle text-ink">{roleList}</td>
                    <td className="p-[12px_16px] align-middle text-ink">{scopeValue}</td>
                    <td className="p-[12px_16px] align-middle text-muted">{permissionSummary}</td>
                    <td className="p-[12px_16px] align-middle">
                      <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${statusClasses[status] || 'bg-[#EEF0F5] text-muted'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-[12px_16px] align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => navigate(`/admin/users/${user.id}`)} className="rounded-[8px] border border-border-color bg-white p-1.5 text-ink cursor-pointer hover:bg-panel" aria-label={`View ${displayName}`}><Eye className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => navigate(`/admin/users/${user.id}/edit`)} className="rounded-[8px] border border-border-color bg-white p-1.5 text-ink cursor-pointer hover:bg-panel" aria-label={`Edit ${displayName}`}><PencilLine className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void handleDeleteUser(user)} className="rounded-[8px] border border-red-200 bg-red-50 p-1.5 text-red-600 cursor-pointer hover:bg-red-100" aria-label={`Delete ${displayName}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="text-left text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Role</th>
                <ColumnFilterHeader label="Type" options={roleTypeOptions} value={roleFilters.type} onChange={(v) => setRoleFilters((f) => ({ ...f, type: v }))} />
                <ColumnFilterHeader label="Scope" options={roleScopeOptions} value={roleFilters.scope} onChange={(v) => setRoleFilters((f) => ({ ...f, scope: v }))} />
                <ColumnFilterHeader label="Members" options={roleMembersOptions} value={roleFilters.members} onChange={(v) => setRoleFilters((f) => ({ ...f, members: v }))} />
                <ColumnFilterHeader label="Status" options={roleStatusOptions} value={roleFilters.status} onChange={(v) => setRoleFilters((f) => ({ ...f, status: v }))} />
                <th className="text-right text-[10.5px] uppercase tracking-[0.5px] text-faint p-[10px_16px] border-b border-border-color font-bold bg-[#FBFCFE]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-[28px_16px] text-center">
                    <div className="text-[12px] font-bold text-ink">{search || activeFilterCount > 0 ? 'No roles match your filters.' : 'No RBAC roles are currently mapped.'}</div>
                    {!search && activeFilterCount === 0 && <div className="mt-1 text-[11.5px] text-muted">Create a role to start assigning permissions.</div>}
                  </td>
                </tr>
              ) : (
                filteredRoles.map(({ raw: role, type, scopeValue, members, status }) => (
                  <tr key={role.id} className="border-b border-[#F0F2F7] last:border-b-0 hover:bg-[#FBFCFE] transition-colors">
                    <td className="p-[12px_16px] align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${colorFor(role.name || 'role')}`}>
                          {initialsOf(role.name || 'Role')}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-ink">{role.name}</div>
                          <div className="truncate text-[11.5px] text-muted">{role.description || 'Role access group'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-[12px_16px] align-middle">
                      <span className="rounded-[6px] bg-[#EEF0F5] px-2 py-0.5 text-[10.5px] font-bold text-ink">{type}</span>
                    </td>
                    <td className="p-[12px_16px] align-middle text-ink">{scopeValue}</td>
                    <td className="p-[12px_16px] align-middle text-ink">{members}</td>
                    <td className="p-[12px_16px] align-middle">
                      <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${statusClasses[status] || 'bg-[#EEF0F5] text-muted'}`}>
                        {status}
                      </span>
                    </td>
                    <td className="p-[12px_16px] align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => navigate(`/admin/roles/${role.id}`)} className="rounded-[8px] border border-border-color bg-white p-1.5 text-ink cursor-pointer hover:bg-panel" aria-label={`View ${role.name}`}><Eye className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => navigate(`/admin/roles/${role.id}/edit`)} className="rounded-[8px] border border-border-color bg-white p-1.5 text-ink cursor-pointer hover:bg-panel" aria-label={`Edit ${role.name}`}><PencilLine className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void handleDeleteRole(role)} className="rounded-[8px] border border-red-200 bg-red-50 p-1.5 text-red-600 cursor-pointer hover:bg-red-100" aria-label={`Delete ${role.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersTable;