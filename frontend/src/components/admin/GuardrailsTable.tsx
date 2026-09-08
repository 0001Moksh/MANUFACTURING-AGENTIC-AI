import React, { useEffect, useState } from 'react';
import {
  Plus,
  Shield,
  Edit2,
  Trash2,
  Power,
  Eye,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { guardrailPolicyService } from '../../services/api';
import { GuardrailFormModal } from './GuardrailFormModal';

export const GuardrailsTable: React.FC = () => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any | null>(null);
  const [viewPolicy, setViewPolicy] = useState<any | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const data = await guardrailPolicyService.getPolicies();
      setPolicies(data || []);
    } catch (err) {
      console.error('Failed to load guardrail policies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleToggle = async (id: number) => {
    try {
      setTogglingId(id);
      await guardrailPolicyService.togglePolicy(id);
      await fetchPolicies();
    } catch (err) {
      console.error('Failed to toggle policy:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the guardrail "${name}"?`)) return;
    try {
      setDeletingId(id);
      await guardrailPolicyService.deletePolicy(id);
      await fetchPolicies();
    } catch (err) {
      console.error('Failed to delete policy:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const priorityStyles: Record<string, string> = {
    Critical: 'bg-rose-100 text-rose-800 border-rose-200',
    High: 'bg-amber-100 text-amber-800 border-amber-200',
    Medium: 'bg-blue-100 text-blue-800 border-blue-200',
    Low: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="min-w-0">
          <h3 className="text-[16px] sm:text-[17px] font-semibold text-slate-900 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <Shield className="h-5 w-5" />
            </div>
            <span className="truncate">Dynamic Policy Engine & Guardrails</span>
          </h3>
          <p className="text-[13px] text-slate-500 mt-1 sm:mt-0.5 sm:ml-11.5 max-w-xl">
            Decoupled policy rules evaluated dynamically across agent workflows, tools, and user roles
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedPolicy(null);
            setShowModal(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-700 shadow-sm transition active:scale-[0.98] shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Guardrail
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Mobile hint */}
        <div className="sm:hidden px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[12px] text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Swipe horizontally to see all columns
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200">
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Guardrail Name
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Type
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Scope
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Target
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Priority
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Status
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Ver.
                </th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Last Modified
                </th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3.5 whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Loader2 className="h-7 w-7 animate-spin text-teal-500" />
                      <span className="text-sm">Loading guardrail policies…</span>
                    </div>
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                        <Shield className="h-6 w-6 opacity-60" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-600">No guardrails configured</p>
                        <p className="text-[13px] mt-1">
                          Click “Add Guardrail” above to create your first policy.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                policies.map((p) => {
                  const isToggling = togglingId === p.id;
                  const isDeleting = deletingId === p.id;

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Name + description */}
                      <td className="px-4 py-3.5 max-w-[240px]">
                        <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                        {p.description && (
                          <div className="text-[12px] text-slate-500 mt-0.5 line-clamp-1">
                            {p.description}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200/80">
                          {p.type}
                        </span>
                      </td>

                      {/* Scope */}
                      <td className="px-4 py-3.5 text-slate-600 font-medium whitespace-nowrap">
                        {p.scope_type}
                      </td>

                      {/* Target */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[12px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                          {p.scope_target || '—'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${priorityStyles[p.priority] || priorityStyles.Low
                            }`}
                        >
                          {p.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.is_enabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${p.is_enabled ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                          />
                          {p.status || (p.is_enabled ? 'Enabled' : 'Disabled')}
                        </span>
                      </td>

                      {/* Version */}
                      <td className="px-4 py-3.5 text-slate-500 font-mono text-[12px] whitespace-nowrap">
                        v{p.version}
                      </td>

                      {/* Last Modified */}
                      <td className="px-4 py-3.5 text-slate-500 text-[12px] whitespace-nowrap">
                        {p.updated_at
                          ? new Date(p.updated_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewPolicy(p)}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="View policy payload"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPolicy(p);
                              setShowModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                            title="Edit guardrail"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleToggle(p.id)}
                            disabled={isToggling}
                            className={`p-1.5 rounded-lg transition disabled:opacity-50 ${p.is_enabled
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-slate-400 hover:bg-slate-100'
                              }`}
                            title={p.is_enabled ? 'Disable guardrail' : 'Enable guardrail'}
                          >
                            {isToggling ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            disabled={isDeleting}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                            title="Delete guardrail"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy Inspection Modal */}
      {viewPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setViewPolicy(null)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 text-[15px] truncate">
                  Policy Inspection
                </h3>
                <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                  {viewPolicy.name}
                </p>
              </div>
              <button
                onClick={() => setViewPolicy(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status + Priority strip */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold border ${viewPolicy.is_enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${viewPolicy.is_enabled ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                  />
                  {viewPolicy.status || (viewPolicy.is_enabled ? 'Enabled' : 'Disabled')}
                </span>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold border ${viewPolicy.priority === 'Critical'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : viewPolicy.priority === 'High'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : viewPolicy.priority === 'Medium'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                >
                  {viewPolicy.priority} Priority
                </span>

                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600 border border-slate-200">
                  {viewPolicy.type}
                </span>

                <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[12px] font-mono text-slate-500 border border-slate-200">
                  v{viewPolicy.version}
                </span>
              </div>

              {/* Description */}
              {viewPolicy.description && (
                <p className="text-[13.5px] text-slate-600 leading-relaxed">
                  {viewPolicy.description}
                </p>
              )}

              {/* Basic Info */}
              <section className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-white/60">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                    Basic Information
                  </h4>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <span className="text-slate-500 shrink-0">Name</span>
                    <span className="font-medium text-slate-800 text-right">{viewPolicy.name}</span>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <span className="text-slate-500 shrink-0">Type</span>
                    <span className="font-medium text-slate-800 text-right">{viewPolicy.type}</span>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <span className="text-slate-500 shrink-0">Priority</span>
                    <span className="font-medium text-slate-800 text-right">{viewPolicy.priority}</span>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <span className="text-slate-500 shrink-0">Status</span>
                    <span className="font-medium text-slate-800 text-right">
                      {viewPolicy.status}
                    </span>
                  </div>
                  {viewPolicy.updated_at && (
                    <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                      <span className="text-slate-500 shrink-0">Last Modified</span>
                      <span className="font-medium text-slate-800 text-right">
                        {new Date(viewPolicy.updated_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Scope */}
              <section className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-white/60">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                    Scope / Target
                  </h4>
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <span className="text-slate-500 shrink-0">Scope Type</span>
                    <span className="font-medium text-slate-800 text-right">
                      {viewPolicy.scope_type}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                    <span className="text-slate-500 shrink-0">Target</span>
                    <span className="font-mono text-[12.5px] text-slate-800 text-right bg-slate-100 px-2 py-0.5 rounded">
                      {viewPolicy.scope_target || '*'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Triggers & Conditions */}
              <section className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-white/60">
                  <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                    Triggers & Conditions
                  </h4>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div className="flex justify-between gap-4 text-[13px]">
                    <span className="text-slate-500">Trigger Event</span>
                    <span className="font-medium text-slate-800">
                      {viewPolicy.triggers_conditions?.trigger_event || '—'}
                    </span>
                  </div>

                  {viewPolicy.triggers_conditions?.conditions?.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Conditions (AND)
                      </span>
                      {viewPolicy.triggers_conditions.conditions.map(
                        (c: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-[12.5px] font-mono text-slate-700"
                          >
                            <span className="text-slate-500">{c.field}</span>
                            <span className="text-teal-600 font-semibold">{c.operator}</span>
                            <span>{c.value}</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-slate-400 italic">
                      No conditions defined
                    </p>
                  )}
                </div>
              </section>

              {/* Type Config */}
              {viewPolicy.type_config && Object.keys(viewPolicy.type_config).length > 0 && (
                <section className="rounded-xl border border-teal-200/70 bg-teal-50/20 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-teal-100/80 bg-white/40">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-teal-700">
                      {viewPolicy.type} Configuration
                    </h4>
                  </div>
                  <div className="divide-y divide-teal-100/60">
                    {Object.entries(viewPolicy.type_config).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between gap-4 px-4 py-2.5 text-[13px]"
                      >
                        <span className="text-slate-500 shrink-0 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="font-medium text-slate-800 text-right break-all">
                          {Array.isArray(value)
                            ? value.join(', ')
                            : String(value ?? '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Execution Behavior */}
              {viewPolicy.execution_behavior && (
                <section className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-white/60">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                      Execution Behavior
                    </h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                      <span className="text-slate-500">Action</span>
                      <span className="font-medium text-slate-800">
                        {viewPolicy.execution_behavior.action}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 px-4 py-2.5 text-[13px]">
                      <span className="text-slate-500">Failure Mode</span>
                      <span className="font-medium text-slate-800">
                        {viewPolicy.execution_behavior.failure_mode}
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <GuardrailFormModal
          initialData={selectedPolicy}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchPolicies();
          }}
        />
      )}
    </div>
  );
};

export default GuardrailsTable;