import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Pencil,
  Trash2,
  Bot,
  Layers,
  Cable,
  Boxes,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Folder,
} from 'lucide-react';
import { api } from '../../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AccessAction = 'read' | 'edit' | 'hitl_approval' | 'full_control';

export type BuilderPermissionRule = {
  module_key: string;
  module_label: string;
  resource_key: string; // '*' means bulk / all resources in module
  resource_label: string;
  actions: AccessAction[];
};

type PermissionResource = {
  resource_key: string;
  label: string;
};

type PermissionModule = {
  module_key: string;
  label: string;
  resources: PermissionResource[];
};

const accessOptions: { value: AccessAction; label: string; short: string }[] = [
  { value: 'read', label: 'Read Only', short: 'Read' },
  { value: 'edit', label: 'Edit Access', short: 'Edit' },
  { value: 'hitl_approval', label: 'HITL Approval', short: 'HITL' },
  { value: 'full_control', label: 'Full Control', short: 'Full' },
];

/* Color-coded pill classes per access action, per spec */
const accessPillClasses: Record<AccessAction, string> = {
  read: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  edit: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hitl_approval: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  full_control: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

/* Solid node classes for flow-diagram access pills (distinct from the softer tinted pills used elsewhere) */
const accessNodeSolidClasses: Record<AccessAction, string> = {
  read: 'bg-teal text-white',
  edit: 'bg-teal text-white',
  hitl_approval: 'bg-amber-400 text-white',
  full_control: 'bg-teal text-white',
};

const BULK_RESOURCE_KEY = '*';

/* Module icon mapping — extend as new module keys are added to the catalog */
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
  value: string | { module_key?: string; resource_key?: string; access_types?: string[]; actions?: AccessAction[] } | null | undefined
): BuilderPermissionRule | null => {
  if (!value) return null;

  if (typeof value === 'object') {
    const moduleKey = value.module_key || '';
    const resourceKey = value.resource_key || '*';
    const actions = Array.isArray(value.actions) && value.actions.length > 0 ? value.actions : normalizeAccessActions(value.access_types ?? []);

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

/* ------------------------------------------------------------------ */
/* Draft chain reducer (uncommitted state, separate from stacked rules)*/
/* ------------------------------------------------------------------ */

type DraftState = {
  moduleKey: string;
  resourceKeys: string[]; // multi-select chips, may include '*'
  actions: AccessAction[];
};

type DraftAction =
  | { type: 'SET_MODULE'; moduleKey: string }
  | { type: 'TOGGLE_RESOURCE'; resourceKey: string }
  | { type: 'TOGGLE_ACTION'; action: AccessAction }
  | { type: 'RESET_CHAIN'; moduleKey?: string }
  | { type: 'LOAD'; draft: DraftState };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'SET_MODULE':
      return { moduleKey: action.moduleKey, resourceKeys: [], actions: [] };
    case 'TOGGLE_RESOURCE': {
      if (action.resourceKey === BULK_RESOURCE_KEY) {
        return { ...state, resourceKeys: state.resourceKeys.includes(BULK_RESOURCE_KEY) ? [] : [BULK_RESOURCE_KEY] };
      }
      const withoutBulk = state.resourceKeys.filter((key) => key !== BULK_RESOURCE_KEY);
      const exists = withoutBulk.includes(action.resourceKey);
      return {
        ...state,
        resourceKeys: exists ? withoutBulk.filter((key) => key !== action.resourceKey) : [...withoutBulk, action.resourceKey],
      };
    }
    case 'TOGGLE_ACTION': {
      const exists = state.actions.includes(action.action);
      return { ...state, actions: exists ? state.actions.filter((item) => item !== action.action) : [...state.actions, action.action] };
    }
    case 'RESET_CHAIN':
      return { moduleKey: action.moduleKey ?? state.moduleKey, resourceKeys: [], actions: [] };
    case 'LOAD':
      return action.draft;
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ruleKey = (moduleKey: string, resourceKey: string) => `${moduleKey}::${resourceKey}`;
const actionMeta = (action: AccessAction) => accessOptions.find((item) => item.value === action);

/* ------------------------------------------------------------------ */
/* Flow diagram — Role -> Module -> Resource -> Access Level map       */
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
  onEdit: (rule: BuilderPermissionRule) => void;
  onRemove: (moduleKey: string, resourceKey: string) => void;
}

const PermissionFlowDiagram: React.FC<PermissionFlowDiagramProps> = ({ roleLabel, rules, onEdit, onRemove }) => {
  const { leaves, moduleRanges, resourceRanges, totalRows } = useMemo(() => {
    const moduleOrder: string[] = [];
    const moduleMap = new Map<string, { label: string; resources: Map<string, { label: string; actions: AccessAction[] }> }>();

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
    const resRanges = new Map<string, { label: string; moduleKey: string; resourceKey: string; start: number; end: number }>();

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

    return { leaves: leafRows, moduleRanges: modRanges, resourceRanges: resRanges, totalRows: row };
  }, [rules]);

  if (totalRows === 0) return null;

  const rowCenterY = (start: number, end: number) => PAD_TOP + ((start + end) / 2 + 0.5) * ROW_H;
  const diagramHeight = PAD_TOP * 2 + totalRows * ROW_H;
  const rootCenterY = rowCenterY(0, totalRows - 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Access Map</div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: DIAGRAM_WIDTH, height: diagramHeight, minWidth: DIAGRAM_WIDTH }}>
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
                d={bezierPath(COL.root.left + COL.root.width, rootCenterY, COL.module.left, rowCenterY(m.start, m.end))}
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
                  d={bezierPath(COL.resource.left + COL.resource.width, rowCenterY(r.start, r.end), COL.action.left, y)}
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
                className="group absolute flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-slate-700 shadow-sm "
                style={{ left: COL.resource.left, width: COL.resource.width, top: centerY - 18 }}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{r.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="Edit rule"
                    onClick={() =>
                      onEdit({
                        module_key: r.moduleKey,
                        module_label: moduleRanges.get(r.moduleKey)?.label ?? r.moduleKey,
                        resource_key: r.resourceKey,
                        resource_label: r.label,
                        actions: leaves.filter((l) => l.moduleKey === r.moduleKey && l.resourceKey === r.resourceKey).map((l) => l.action),
                      })
                    }
                    className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:bg-slate-50"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete rule"
                    onClick={() => onRemove(r.moduleKey, r.resourceKey)}
                    className="rounded border border-red-200 bg-red-50 p-0.5 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </span>
              </div>
            );
          })}

          {/* Access level pill nodes */}
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
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface PermissionBuilderProps {
  value: BuilderPermissionRule[];
  onChange: (rules: BuilderPermissionRule[]) => void;
  /** Label shown in the root node of the access map, e.g. "Role: Admin" */
  roleLabel?: string;
}

export const PermissionBuilder: React.FC<PermissionBuilderProps> = ({ value, onChange, roleLabel = 'Role' }) => {
  const [catalog, setCatalog] = useState<PermissionModule[]>([]);
  const [rules, setRules] = useState<BuilderPermissionRule[]>(value ?? []);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState('');
  const [duplicateNotice, setDuplicateNotice] = useState<string>('');
  const [viewMode, setViewMode] = useState<'map' | 'cards'>('map');

  const [draft, dispatch] = useReducer(draftReducer, { moduleKey: '', resourceKeys: [], actions: [] });

  useEffect(() => {
    setRules(value ?? []);
  }, [value]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await api.get('/rbac/permissions/catalog');
        const nextCatalog: PermissionModule[] = Array.isArray(response.data) ? response.data : [];
        setCatalog(nextCatalog);
        if (nextCatalog.length > 0) {
          dispatch({ type: 'SET_MODULE', moduleKey: nextCatalog[0].module_key });
        }
      } catch {
        setCatalog([]);
      }
    };
    void loadCatalog();
  }, []);

  const activeModule = useMemo(
    () => catalog.find((item) => item.module_key === draft.moduleKey) ?? catalog[0],
    [catalog, draft.moduleKey]
  );

  const resources = activeModule?.resources ?? [];
  const filteredResources = useMemo(
    () => resources.filter((resource) => resource.label.toLowerCase().includes(resourceFilter.toLowerCase())),
    [resources, resourceFilter]
  );

  const updateRules = (nextRules: BuilderPermissionRule[]) => {
    setRules(nextRules);
    onChange(nextRules);
  };

  /* -------------------------- commit chain -------------------------- */

  const canCommit = Boolean(activeModule) && draft.resourceKeys.length > 0 && draft.actions.length > 0;

  const commitChain = () => {
    if (!activeModule || !canCommit) return;
    setDuplicateNotice('');

    const newRules: BuilderPermissionRule[] = draft.resourceKeys.map((resourceKey) => {
      const resource =
        resourceKey === BULK_RESOURCE_KEY
          ? { resource_key: BULK_RESOURCE_KEY, label: 'All / Bulk' }
          : resources.find((item) => item.resource_key === resourceKey) ?? { resource_key: resourceKey, label: resourceKey };

      return {
        module_key: activeModule.module_key,
        module_label: activeModule.label,
        resource_key: resource.resource_key,
        resource_label: resource.label,
        actions: [...draft.actions],
      };
    });

    let mergedCount = 0;
    const nextRules = [...rules];

    newRules.forEach((incoming) => {
      const existingIndex = nextRules.findIndex(
        (rule) => editingKey !== ruleKey(rule.module_key, rule.resource_key) &&
          rule.module_key === incoming.module_key &&
          rule.resource_key === incoming.resource_key
      );

      if (existingIndex >= 0) {
        const merged = Array.from(new Set([...nextRules[existingIndex].actions, ...incoming.actions])) as AccessAction[];
        nextRules[existingIndex] = { ...nextRules[existingIndex], actions: merged };
        mergedCount += 1;
      } else {
        nextRules.push(incoming);
      }
    });

    if (editingKey) {
      const [oldModule, oldResource] = editingKey.split('::');
      const stillNeeded = newRules.some((r) => r.module_key === oldModule && r.resource_key === oldResource);
      if (!stillNeeded) {
        const idx = nextRules.findIndex((r) => r.module_key === oldModule && r.resource_key === oldResource);
        if (idx >= 0) nextRules.splice(idx, 1);
      }
    }

    updateRules(nextRules);
    if (mergedCount > 0) {
      setDuplicateNotice(`Merged actions into ${mergedCount} existing rule(s) for the same module + resource.`);
    }

    setEditingKey(null);
    dispatch({ type: 'RESET_CHAIN', moduleKey: activeModule.module_key });
    setResourceFilter('');
  };

  const clearDraft = () => {
    dispatch({ type: 'RESET_CHAIN', moduleKey: draft.moduleKey });
    setEditingKey(null);
    setResourceFilter('');
  };

  /* --------------------------- row actions --------------------------- */

  const removeRule = (moduleKey: string, resourceKey: string) => {
    updateRules(rules.filter((rule) => !(rule.module_key === moduleKey && rule.resource_key === resourceKey)));
  };

  const removeModuleGroup = (moduleKey: string) => {
    updateRules(rules.filter((rule) => rule.module_key !== moduleKey));
  };

  const editRule = (rule: BuilderPermissionRule) => {
    setEditingKey(ruleKey(rule.module_key, rule.resource_key));
    dispatch({
      type: 'LOAD',
      draft: { moduleKey: rule.module_key, resourceKeys: [rule.resource_key], actions: [...rule.actions] },
    });
  };

  const selectAllReadOnly = () => {
    if (catalog.length === 0) return;
    const nextRules = [...rules];
    catalog.forEach((module) => {
      const existingIndex = nextRules.findIndex((rule) => rule.module_key === module.module_key && rule.resource_key === BULK_RESOURCE_KEY);
      if (existingIndex >= 0) {
        const merged = Array.from(new Set([...nextRules[existingIndex].actions, 'read' as AccessAction]));
        nextRules[existingIndex] = { ...nextRules[existingIndex], actions: merged };
      } else {
        nextRules.push({
          module_key: module.module_key,
          module_label: module.label,
          resource_key: BULK_RESOURCE_KEY,
          resource_label: 'All / Bulk',
          actions: ['read'],
        });
      }
    });
    updateRules(nextRules);
    setDuplicateNotice('Applied read-only access across all modules.');
  };

  /* ---------------------------- grouping ---------------------------- */

  const groupedRules = useMemo(() => {
    const groups = new Map<string, { label: string; rows: BuilderPermissionRule[] }>();
    rules.forEach((rule) => {
      const entry = groups.get(rule.module_key) ?? { label: rule.module_label, rows: [] };
      entry.rows.push(rule);
      groups.set(rule.module_key, entry);
    });
    return Array.from(groups.entries());
  }, [rules]);

  /* ------------------------------ render ------------------------------ */

  return (
    <div className="mt-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Configured Permissions</div>
          <div className="text-[10.5px] text-muted mt-0.5">{rules.length} rule(s) across {groupedRules.length} module(s)</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-[8px] border border-border-color bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`rounded-[6px] px-2.5 py-1 text-[11px] font-bold cursor-pointer ${viewMode === 'map' ? 'bg-teal text-white' : 'text-ink hover:bg-panel'}`}
            >
              Access Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-[6px] px-2.5 py-1 text-[11px] font-bold cursor-pointer ${viewMode === 'cards' ? 'bg-teal text-white' : 'text-ink hover:bg-panel'}`}
            >
              Cards
            </button>
          </div>
          <button
            type="button"
            onClick={selectAllReadOnly}
            className="rounded-[8px] border border-border-color bg-white px-3 py-1.5 text-[11px] font-bold text-ink cursor-pointer hover:bg-panel"
          >
            Select All Modules (Read-Only)
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MODULE SUMMARY — Access Map (default) or Enterprise Card Matrix   */}
      {/* ================================================================ */}
      {groupedRules.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200  p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 ">
            <ShieldAlert className="h-6 w-6 text-slate-400 " />
          </div>
          <div className="text-[13px] font-semibold text-slate-600 ">
            No permissions configured yet.
          </div>
          <div className="mt-1 text-[12px] text-slate-400 ">
            Select a module and resources above to build access rules.
          </div>
        </div>
      ) : viewMode === 'map' ? (
        <PermissionFlowDiagram roleLabel={roleLabel} rules={rules} onEdit={editRule} onRemove={removeRule} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {groupedRules.map(([moduleKey, group]) => {
            const ModuleIcon = getModuleIcon(moduleKey);
            return (
              <div
                key={moduleKey}
                className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm transition-all hover:border-indigo-500/40 hover:shadow-md  "
              >
                {/* Module Header Row */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ">
                      <ModuleIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-slate-800 ">
                        {group.label}
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 ">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        {group.rows.length} {group.rows.length === 1 ? 'Rule' : 'Rules'} Configured
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions (module-level) */}
                  <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      title="Delete all rules for this module"
                      onClick={() => removeModuleGroup(moduleKey)}
                      className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 "
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Per-resource rows: resource badge + permission matrix */}
                <div className="space-y-2.5 border-t border-slate-200 pt-3 ">
                  {group.rows.map((rule) => {
                    const isBulk = rule.resource_key === BULK_RESOURCE_KEY;
                    return (
                      <div
                        key={ruleKey(rule.module_key, rule.resource_key)}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white/60 p-2.5 "
                      >
                        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                          {/* Target Resource badge */}
                          {isBulk ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-600">
                              All Resources
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {rule.resource_label}
                            </span>
                          )}

                          {/* Access Permissions matrix */}
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

                        {/* Row-level quick actions */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            title="Edit rule"
                            onClick={() => editRule(rule)}
                            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title="Delete rule"
                            onClick={() => removeRule(rule.module_key, rule.resource_key)}
                            className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 "
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
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

      {/* Progressive cascading builder */}
      <div className="rounded-[14px] border border-border-color bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Permission Builder</div>
          {editingKey && (
            <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-[10.5px] font-bold text-teal">Editing existing rule</span>
          )}
        </div>

      

        {duplicateNotice && (
          <div className="mb-3 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            {duplicateNotice}
          </div>
        )}

        {/* Columns as distinct cards */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Column 1 - Module */}
          <div className="rounded-[10px] border border-border-color bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[9px] font-bold text-white">1</span>
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Module</label>
            </div>
            <select
              value={draft.moduleKey}
              onChange={(event) => dispatch({ type: 'SET_MODULE', moduleKey: event.target.value })}
              className="w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-teal"
            >
              {catalog.map((module) => (
                <option key={module.module_key} value={module.module_key}>{module.label}</option>
              ))}
            </select>
          </div>

          {/* Column 2 - Resource (multi-select chips + bulk) */}
          <div className={`rounded-[10px] border border-border-color bg-white p-3 ${!activeModule ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[9px] font-bold text-white">2</span>
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Resource(s)</label>
            </div>
            <input
              value={resourceFilter}
              onChange={(event) => setResourceFilter(event.target.value)}
              placeholder="Search resources..."
              className="mb-2 w-full rounded-[10px] border border-border-color bg-white px-3 py-2 text-[12px] text-ink focus:outline-none focus:border-teal"
            />
            <div className="flex max-h-[130px] flex-wrap content-start gap-1.5 overflow-y-auto pr-0.5">
              <button
                type="button"
                onClick={() => dispatch({ type: 'TOGGLE_RESOURCE', resourceKey: BULK_RESOURCE_KEY })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  draft.resourceKeys.includes(BULK_RESOURCE_KEY)
                    ? 'border-teal bg-teal text-white'
                    : 'border-border-color bg-white text-ink hover:bg-panel'
                }`}
              >
                All / Bulk
              </button>
              {filteredResources.map((resource) => (
                <button
                  key={resource.resource_key}
                  type="button"
                  disabled={draft.resourceKeys.includes(BULK_RESOURCE_KEY)}
                  onClick={() => dispatch({ type: 'TOGGLE_RESOURCE', resourceKey: resource.resource_key })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-40 ${
                    draft.resourceKeys.includes(resource.resource_key)
                      ? 'border-teal bg-teal text-white'
                      : 'border-border-color bg-white text-ink hover:bg-panel'
                  }`}
                >
                  {resource.label}
                </button>
              ))}
              {filteredResources.length === 0 && (
                <span className="text-[11px] text-muted italic px-1 py-1">No resources match.</span>
              )}
            </div>
          </div>

          {/* Column 3 - Access level */}
          <div className={`rounded-[10px] border border-border-color bg-white p-3 ${draft.resourceKeys.length === 0 ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal text-[9px] font-bold text-white">3</span>
              <label className="text-[11px] font-bold uppercase tracking-[0.5px] text-faint">Access Level</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {accessOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_ACTION', action: option.value })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                    draft.actions.includes(option.value)
                      ? 'border-teal bg-teal text-white'
                      : 'border-border-color bg-white text-ink hover:bg-panel'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Commit controls */}
        <div className="mt-4 flex items-center justify-end gap-2.5 border-t border-border-color pt-4">
          <button type="button" onClick={clearDraft} className="rounded-[10px] border border-border-color bg-white px-3.5 py-2 text-[12px] font-bold text-ink cursor-pointer hover:bg-panel">
            Reset / Clear
          </button>
          <button
            type="button"
            onClick={commitChain}
            disabled={!canCommit}
            className="rounded-[10px] bg-teal px-4 py-2 text-[12px] font-bold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            {editingKey ? 'Update Rule' : '+ Add Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionBuilder;