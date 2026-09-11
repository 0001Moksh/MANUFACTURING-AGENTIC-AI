import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  Bot,
  Layers,
  Cable,
  Boxes,
  Folder,
  UserCog,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';

/* ------------------------------------------------------------------ */
/* Types & helpers (same as PermissionBuilder)                        */
/* ------------------------------------------------------------------ */
export type AccessAction = 'read' | 'edit' | 'hitl_approval' | 'full_control';

export type BuilderPermissionRule = {
  module_key: string;
  module_label: string;
  resource_key: string;
  resource_label: string;
  actions: AccessAction[];
};

const accessOptions: { value: AccessAction; label: string; short: string }[] = [
  { value: 'read', label: 'Read Only', short: 'Read' },
  { value: 'edit', label: 'Edit Access', short: 'Edit' },
  { value: 'hitl_approval', label: 'HITL Approval', short: 'HITL' },
  { value: 'full_control', label: 'Full Control', short: 'Full' },
];

const accessPillClasses: Record<AccessAction, string> = {
  read: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  edit: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hitl_approval: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  full_control: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

const accessNodeSolidClasses: Record<AccessAction, string> = {
  read: 'bg-teal text-white',
  edit: 'bg-teal text-white',
  hitl_approval: 'bg-amber-400 text-white',
  full_control: 'bg-teal text-white',
};

const BULK_RESOURCE_KEY = '*';

const moduleIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ai_agents: Bot,
  agents: Bot,
  use_case_library: Layers,
  use_cases: Layers,
  integrations: Cable,
};

const getModuleIcon = (moduleKey: string) => moduleIconMap[moduleKey] ?? Boxes;

const normalizeAccessActions = (values: string[] = []): AccessAction[] => {
  const actionSet = new Set<AccessAction>();
  values.forEach((value) => {
    if (!value) return;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'read_only' || normalized === 'read') actionSet.add('read');
    if (normalized === 'edit') actionSet.add('edit');
    if (normalized === 'hitl_approval') actionSet.add('hitl_approval');
    if (normalized === 'full_control') actionSet.add('full_control');
    if (normalized === 'read_only_edit') {
      actionSet.add('read');
      actionSet.add('edit');
    }
  });
  return Array.from(actionSet);
};

export const parsePermissionValue = (
  value:
    | string
    | {
        module_key?: string;
        resource_key?: string;
        access_types?: string[];
        actions?: AccessAction[];
      }
    | null
    | undefined
): BuilderPermissionRule | null => {
  if (!value) return null;

  if (typeof value === 'object') {
    const moduleKey = value.module_key || '';
    const resourceKey = value.resource_key || '*';
    const actions =
      Array.isArray(value.actions) && value.actions.length > 0
        ? value.actions
        : normalizeAccessActions(value.access_types ?? []);
    if (!moduleKey) return null;
    return {
      module_key: moduleKey,
      module_label: moduleKey.replace(/_/g, ' '),
      resource_key: resourceKey,
      resource_label: resourceKey === '*' ? 'All / Bulk' : resourceKey.replace(/_/g, ' '),
      actions,
    };
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const [moduleKey, resourceKey, ...accessTokens] = parts;
    if (!moduleKey || !resourceKey) return null;
    const actions = normalizeAccessActions(accessTokens.length ? accessTokens : ['read_only']);
    return {
      module_key: moduleKey,
      module_label: moduleKey.replace(/_/g, ' '),
      resource_key: resourceKey,
      resource_label: resourceKey === '*' ? 'All / Bulk' : resourceKey.replace(/_/g, ' '),
      actions,
    };
  }

  if (trimmed.includes('.')) {
    const [moduleKey, resourceKey] = trimmed.split('.', 2);
    return {
      module_key: moduleKey,
      module_label: moduleKey.replace(/_/g, ' '),
      resource_key: resourceKey,
      resource_label: resourceKey === '*' ? 'All / Bulk' : resourceKey.replace(/_/g, ' '),
      actions: ['read'],
    };
  }

  return null;
};

const ruleKey = (moduleKey: string, resourceKey: string) => `${moduleKey}::${resourceKey}`;
const actionMeta = (action: AccessAction) => accessOptions.find((item) => item.value === action);

/* ------------------------------------------------------------------ */
/* Flow diagram (Access Map)                                          */
/* ------------------------------------------------------------------ */
const ROW_H = 52;
const PAD_TOP = 24;
const COL = {
  root: { left: 16, width: 128 },
  module: { left: 208, width: 168 },
  resource: { left: 440, width: 190 },
  action: { left: 694, width: 150 },
};
const DIAGRAM_WIDTH = COL.action.left + COL.action.width + 24;

type FlowLeaf = {
  moduleKey: string;
  moduleLabel: string;
  resourceKey: string;
  resourceLabel: string;
  action: AccessAction;
  row: number;
};

const bezierPath = (x1: number, y1: number, x2: number, y2: number) => {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
};

interface PermissionFlowDiagramProps {
  roleLabel: string;
  rules: BuilderPermissionRule[];
}

const PermissionFlowDiagram: React.FC<PermissionFlowDiagramProps> = ({ roleLabel, rules }) => {
  const { leaves, moduleRanges, resourceRanges, totalRows } = useMemo(() => {
    const moduleOrder: string[] = [];
    const moduleMap = new Map<
      string,
      { label: string; resources: Map<string, { label: string; actions: AccessAction[] }> }
    >();

    rules.forEach((rule) => {
      if (!moduleMap.has(rule.module_key)) {
        moduleMap.set(rule.module_key, { label: rule.module_label, resources: new Map() });
        moduleOrder.push(rule.module_key);
      }
      const moduleEntry = moduleMap.get(rule.module_key)!;
      moduleEntry.resources.set(rule.resource_key, {
        label: rule.resource_key === BULK_RESOURCE_KEY ? 'All / Bulk' : rule.resource_label,
        actions: rule.actions.length > 0 ? rule.actions : ['read'],
      });
    });

    const leafRows: FlowLeaf[] = [];
    const modRanges = new Map<string, { label: string; start: number; end: number }>();
    const resRanges = new Map<
      string,
      { label: string; moduleKey: string; resourceKey: string; start: number; end: number }
    >();

    let row = 0;
    moduleOrder.forEach((moduleKey) => {
      const moduleEntry = moduleMap.get(moduleKey)!;
      const moduleStart = row;

      moduleEntry.resources.forEach((resourceEntry, resourceKey) => {
        const resourceStart = row;
        resourceEntry.actions.forEach((action) => {
          leafRows.push({
            moduleKey,
            moduleLabel: moduleEntry.label,
            resourceKey,
            resourceLabel: resourceEntry.label,
            action,
            row,
          });
          row += 1;
        });
        resRanges.set(`${moduleKey}::${resourceKey}`, {
          label: resourceEntry.label,
          moduleKey,
          resourceKey,
          start: resourceStart,
          end: row - 1,
        });
      });

      modRanges.set(moduleKey, { label: moduleEntry.label, start: moduleStart, end: row - 1 });
    });

    return {
      leaves: leafRows,
      moduleRanges: modRanges,
      resourceRanges: resRanges,
      totalRows: row,
    };
  }, [rules]);

  if (totalRows === 0) return null;

  const rowCenterY = (start: number, end: number) => PAD_TOP + ((start + end) / 2 + 0.5) * ROW_H;
  const diagramHeight = PAD_TOP * 2 + totalRows * ROW_H;
  const rootCenterY = rowCenterY(0, totalRows - 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.5px] text-faint">
        Access Map
      </div>
      <div className="overflow-x-auto">
        <div
          className="relative"
          style={{ width: DIAGRAM_WIDTH, height: diagramHeight, minWidth: DIAGRAM_WIDTH }}
        >
          {/* Connector lines */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={DIAGRAM_WIDTH}
            height={diagramHeight}
            viewBox={`0 0 ${DIAGRAM_WIDTH} ${diagramHeight}`}
          >
            {Array.from(moduleRanges.entries()).map(([moduleKey, m]) => (
              <path
                key={`root-${moduleKey}`}
                d={bezierPath(
                  COL.root.left + COL.root.width,
                  rootCenterY,
                  COL.module.left,
                  rowCenterY(m.start, m.end)
                )}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1.5}
              />
            ))}
            {Array.from(resourceRanges.values()).map((r) => {
              const m = moduleRanges.get(r.moduleKey)!;
              return (
                <path
                  key={`mod-${r.moduleKey}-${r.resourceKey}`}
                  d={bezierPath(
                    COL.module.left + COL.module.width,
                    rowCenterY(m.start, m.end),
                    COL.resource.left,
                    rowCenterY(r.start, r.end)
                  )}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
              );
            })}
            {leaves.map((leaf) => {
              const r = resourceRanges.get(`${leaf.moduleKey}::${leaf.resourceKey}`)!;
              const y = PAD_TOP + (leaf.row + 0.5) * ROW_H;
              return (
                <path
                  key={`res-${leaf.moduleKey}-${leaf.resourceKey}-${leaf.action}`}
                  d={bezierPath(
                    COL.resource.left + COL.resource.width,
                    rowCenterY(r.start, r.end),
                    COL.action.left,
                    y
                  )}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>

          {/* Root node */}
          <div
            className="absolute flex items-center gap-2 rounded-full bg-teal px-3 py-2 text-[12px] font-bold text-white shadow-sm"
            style={{ left: COL.root.left, width: COL.root.width, top: rootCenterY - 18 }}
          >
            <UserCog className="h-4 w-4 shrink-0" />
            <span className="truncate">{roleLabel}</span>
          </div>

          {/* Module nodes */}
          {Array.from(moduleRanges.entries()).map(([moduleKey, m]) => {
            const ModuleIcon = getModuleIcon(moduleKey);
            const centerY = rowCenterY(m.start, m.end);
            return (
              <div
                key={moduleKey}
                className="absolute flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-700 shadow-sm "
                style={{ left: COL.module.left, width: COL.module.width, top: centerY - 18 }}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-500/10 text-indigo-600">
                  <ModuleIcon className="h-3 w-3" />
                </span>
                <span className="truncate">{m.label}</span>
              </div>
            );
          })}

          {/* Resource nodes */}
          {Array.from(resourceRanges.values()).map((r) => {
            const centerY = rowCenterY(r.start, r.end);
            return (
              <div
                key={`${r.moduleKey}::${r.resourceKey}`}
                className="absolute flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-slate-700 shadow-sm "
                style={{ left: COL.resource.left, width: COL.resource.width, top: centerY - 18 }}
              >
                <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{r.label}</span>
              </div>
            );
          })}

          {/* Access level pills */}
          {leaves.map((leaf) => {
            const y = PAD_TOP + (leaf.row + 0.5) * ROW_H;
            return (
              <div
                key={`${leaf.moduleKey}-${leaf.resourceKey}-${leaf.action}`}
                className={`absolute flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm ${accessNodeSolidClasses[leaf.action]}`}
                style={{ left: COL.action.left, width: COL.action.width, top: y - 15 }}
              >
                {actionMeta(leaf.action)?.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Role Detail Page                                                   */
/* ------------------------------------------------------------------ */
export const RoleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/rbac/roles');
        const found = Array.isArray(response.data)
          ? response.data.find((item: any) => String(item.id) === String(id))
          : null;
        setRole(
          found ?? {
            id,
            name: 'Role',
            type: 'Custom',
            status: 'ACTIVE',
            permissions: [],
            scope: { type: 'Platform', level: 'Platform' },
            user_count: 0,
          }
        );
      } catch {
        setRole({
          id,
          name: 'Role',
          type: 'Custom',
          status: 'ACTIVE',
          permissions: [],
          scope: { type: 'Platform', level: 'Platform' },
          user_count: 0,
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  // Parse raw permissions into structured rules
  const rules: BuilderPermissionRule[] = useMemo(() => {
    if (!role?.permissions) return [];
    const parsed: BuilderPermissionRule[] = [];

    role.permissions.forEach((perm: any) => {
      const rule = parsePermissionValue(perm);
      if (rule) parsed.push(rule);
    });

    // Fallback for simple string permissions like "sites.view"
    if (parsed.length === 0 && Array.isArray(role.permissions)) {
      role.permissions.forEach((p: string) => {
        if (typeof p === 'string' && p.includes('.')) {
          const [moduleKey, resourceKey] = p.split('.', 2);
          parsed.push({
            module_key: moduleKey,
            module_label: moduleKey.replace(/_/g, ' '),
            resource_key: resourceKey,
            resource_label: resourceKey,
            actions: ['read'],
          });
        }
      });
    }

    return parsed;
  }, [role]);

  const groupedRules = useMemo(() => {
    const groups = new Map<string, { label: string; rows: BuilderPermissionRule[] }>();
    rules.forEach((rule) => {
      const entry = groups.get(rule.module_key) ?? { label: rule.module_label, rows: [] };
      entry.rows.push(rule);
      groups.set(rule.module_key, entry);
    });
    return Array.from(groups.entries());
  }, [rules]);

  if (loading) {
    return <div className="p-6 text-[13px] text-muted">Loading role details…</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin?pane=users&tab=roles')}
            className="rounded-[10px] border border-border-color bg-white p-2 text-ink cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="text-[11px] uppercase tracking-[0.6px] text-muted font-bold">
              Role profile
            </div>
            <h2 className="font-head text-[28px] font-extrabold text-ink mt-1">{role.name}</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/admin/roles/${id}/edit`)}
          className="rounded-[8px] border border-border-color bg-white px-3 py-2 text-[12px] font-bold text-ink cursor-pointer"
        >
          Edit
        </button>
      </div>

      {/* Overview + Access Map */}
      <div className="grid grid-cols-1 gap-5">
        {/* Overview card */}
        <div className="bg-panel border border-border-color rounded-[14px] p-4">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-muted uppercase tracking-[0.5px]">
            <ShieldCheck className="h-4 w-4" />
            Overview
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
            <div>
              <span className="block text-faint text-[10.5px] uppercase">Status</span>
              <span className="font-bold text-ink">{role.status}</span>
            </div>
            <div>
              <span className="block text-faint text-[10.5px] uppercase">Scope</span>
              <span className="font-bold text-ink">
                {role.scope?.value || role.scope?.type || 'Global'}
              </span>
            </div>
            <div>
              <span className="block text-faint text-[10.5px] uppercase">Assigned users</span>
              <span className="font-bold text-ink">{role.user_count || 0}</span>
            </div>
            <div>
              <span className="block text-faint text-[10.5px] uppercase">Permission rules</span>
              <span className="font-bold text-ink">{rules.length}</span>
            </div>
          </div>
        </div>

        {/* Access Map / Cards toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-faint">
              Configured Permissions
            </div>
            <div className="text-[10.5px] text-muted mt-0.5">
              {rules.length} rule(s) across {groupedRules.length} module(s)
            </div>
          </div>
          <div className="flex items-center rounded-[8px] border border-border-color bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`rounded-[6px] px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                viewMode === 'map' ? 'bg-teal text-white' : 'text-ink hover:bg-panel'
              }`}
            >
              Access Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-[6px] px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                viewMode === 'cards' ? 'bg-teal text-white' : 'text-ink hover:bg-panel'
              }`}
            >
              Cards
            </button>
          </div>
        </div>

        {/* Empty state */}
        {rules.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200  p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 ">
              <ShieldAlert className="h-6 w-6 text-slate-400 " />
            </div>
            <div className="text-[13px] font-semibold text-slate-600 ">
              No permissions configured yet.
            </div>
            <div className="mt-1 text-[12px] text-slate-400 ">
              Edit this role to add access rules.
            </div>
          </div>
        ) : viewMode === 'map' ? (
          <PermissionFlowDiagram roleLabel={role.name || 'Role'} rules={rules} />
        ) : (
          /* Cards view */
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {groupedRules.map(([moduleKey, group]) => {
              const ModuleIcon = getModuleIcon(moduleKey);
              return (
                <div
                  key={moduleKey}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm  "
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                      <ModuleIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-800 ">
                        {group.label}
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        {group.rows.length} {group.rows.length === 1 ? 'Rule' : 'Rules'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 border-t border-slate-200 pt-3 ">
                    {group.rows.map((rule) => {
                      const isBulk = rule.resource_key === BULK_RESOURCE_KEY;
                      return (
                        <div
                          key={ruleKey(rule.module_key, rule.resource_key)}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/60 p-2.5 "
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {isBulk ? (
                              <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-600">
                                All Resources
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                {rule.resource_label}
                              </span>
                            )}
                            <div className="flex flex-wrap gap-1">
                              {rule.actions.map((action) => (
                                <span
                                  key={action}
                                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${accessPillClasses[action]}`}
                                >
                                  {actionMeta(action)?.short}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};