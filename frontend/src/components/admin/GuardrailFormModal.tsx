import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Shield,
  AlertTriangle,
  Layers,
  Zap,
  Sliders,
  CheckCircle2,
  Lock,
  Loader2,
} from 'lucide-react';
import { guardrailPolicyService } from '../../services/api';

interface GuardrailFormModalProps {
  initialData?: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export const GuardrailFormModal: React.FC<GuardrailFormModalProps> = ({
  initialData,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(initialData);

  // Section 1
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [priority, setPriority] = useState(initialData?.priority || 'Medium');
  const [status, setStatus] = useState(initialData?.status || 'Active');

  // Section 2
  const [scopeType, setScopeType] = useState(initialData?.scope_type || 'Global');
  const [scopeTarget, setScopeTarget] = useState(initialData?.scope_target || '*');

  // Section 3
  const [triggerEvent, setTriggerEvent] = useState(
    initialData?.triggers_conditions?.trigger_event || 'Before Execution'
  );
  const [conditions, setConditions] = useState<
    Array<{ field: string; operator: string; value: string }>
  >(initialData?.triggers_conditions?.conditions || []);

  // Section 4
  const [type, setType] = useState(initialData?.type || 'HITL');

  // Section 5 – type configs
  const [approverType, setApproverType] = useState(
    initialData?.type_config?.approver_type || 'Role'
  );
  const [approverTarget, setApproverTarget] = useState(
    initialData?.type_config?.approver_target || 'Super Admin'
  );
  const [sequence, setSequence] = useState(
    initialData?.type_config?.sequence || 'Sequential'
  );
  const [channel, setChannel] = useState(
    initialData?.type_config?.channel || 'Both'
  );
  const [timeoutMinutes, setTimeoutMinutes] = useState(
    initialData?.type_config?.timeout_minutes || 1440
  );

  const [loggingTargets, setLoggingTargets] = useState<string[]>(
    initialData?.type_config?.logging_targets || [
      'LLM Cost',
      'Token Usage',
      'Tool Calls',
    ]
  );
  const [retentionDays, setRetentionDays] = useState(
    initialData?.type_config?.retention_days || 365
  );

  const [allowThreshold, setAllowThreshold] = useState(
    initialData?.type_config?.allow_threshold || 0.4
  );
  const [notifyThreshold, setNotifyThreshold] = useState(
    initialData?.type_config?.notify_threshold || 0.7
  );
  const [hitlThreshold, setHitlThreshold] = useState(
    initialData?.type_config?.hitl_threshold || 0.9
  );

  const [maxTokens, setMaxTokens] = useState(
    initialData?.type_config?.max_tokens || 4000
  );
  const [maxCostUsd, setMaxCostUsd] = useState(
    initialData?.type_config?.max_cost_usd || 1.0
  );
  const [activeHours, setActiveHours] = useState(
    initialData?.type_config?.active_hours || '00:00-23:59'
  );

  // Section 6
  const [action, setAction] = useState(
    initialData?.execution_behavior?.action || 'Require HITL'
  );
  const [failureMode, setFailureMode] = useState(
    initialData?.execution_behavior?.failure_mode || 'Fail Closed'
  );
  const [changeReason, setChangeReason] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addCondition = () => {
    setConditions([...conditions, { field: 'risk_score', operator: '>=', value: '0.7' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: string) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const toggleLoggingTarget = (item: string) => {
    if (loggingTargets.includes(item)) {
      setLoggingTargets(loggingTargets.filter((t) => t !== item));
    } else {
      setLoggingTargets([...loggingTargets, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Guardrail Policy Name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    let typeConfig: any = {};
    if (type === 'HITL') {
      typeConfig = {
        approver_type: approverType,
        approver_target: approverTarget,
        sequence,
        channel,
        timeout_minutes: Number(timeoutMinutes),
      };
    } else if (type === 'Traceability') {
      typeConfig = {
        logging_targets: loggingTargets,
        retention_days: Number(retentionDays),
      };
    } else if (type === 'RiskBased') {
      typeConfig = {
        allow_threshold: Number(allowThreshold),
        notify_threshold: Number(notifyThreshold),
        hitl_threshold: Number(hitlThreshold),
      };
    } else if (type === 'LimitTime') {
      typeConfig = {
        max_tokens: Number(maxTokens),
        max_cost_usd: Number(maxCostUsd),
        active_hours: activeHours,
      };
    } else if (type === 'AccessControl') {
      typeConfig = { access_rule: 'Deny', restricted_roles: ['Operator'] };
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      scope_type: scopeType,
      scope_target: scopeTarget.trim() || '*',
      priority,
      status,
      is_enabled: status === 'Active',
      triggers_conditions: {
        trigger_event: triggerEvent,
        conditions,
      },
      type_config: typeConfig,
      execution_behavior: {
        action,
        failure_mode: failureMode,
      },
      change_reason:
        changeReason.trim() ||
        (isEditing ? 'Updated via Admin Console' : 'Created via Admin Console'),
    };

    try {
      if (isEditing) {
        await guardrailPolicyService.updatePolicy(initialData.id, payload);
      } else {
        await guardrailPolicyService.createPolicy(payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save guardrail policy.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 transition';
  const labelClass = 'block text-[12px] font-semibold text-slate-700 mb-1.5';

  const guardrailTypes = [
    {
      id: 'HITL',
      label: 'Human-in-the-Loop',
      desc: 'Require approval before action execution',
    },
    {
      id: 'Traceability',
      label: 'Audit & Traceability',
      desc: 'Log model parameters, costs, and tool calls',
    },
    {
      id: 'RiskBased',
      label: 'Risk-Based Control',
      desc: 'Categorize actions by evaluated risk score',
    },
    {
      id: 'AccessControl',
      label: 'Access & Security',
      desc: 'Deterministic firewall & role restrictions',
    },
    {
      id: 'LimitTime',
      label: 'Cost / Time Limits',
      desc: 'Set token limits & active operational hours',
    },
    {
      id: 'DataPrivacy',
      label: 'Data Privacy',
      desc: 'Mask sensitive PII and confidential terms',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Sticky Header */}
        <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] sm:text-[17px] font-semibold text-slate-900 truncate">
                {isEditing ? 'Edit Guardrail Policy' : 'Create Guardrail Policy'}
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5 truncate">
                Central rules evaluated independently by the Guardrail Engine
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 sm:mx-6 mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-[13px] text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form
          id="guardrail-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5"
        >
          {/* 1. Basic Information */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-slate-600">
              <Layers className="h-4 w-4 text-teal-600" />
              1. Basic Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Policy Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. High-Risk Action Guardrail"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={inputClass}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="Active">Active</option>
                  <option value="Draft">Draft</option>
                  <option value="Disabled">Disabled</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the policy purpose and scope…"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* 2. Scope */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-slate-600">
              <Zap className="h-4 w-4 text-teal-600" />
              2. Scope / Target Mapping
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Scope Type</label>
                <select
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value)}
                  className={inputClass}
                >
                  <option value="Global">Global (All Modules)</option>
                  <option value="UseCase">Use Case Library</option>
                  <option value="Workflow">Workflow</option>
                  <option value="Agent">Agent</option>
                  <option value="Action">Action / Tool</option>
                  <option value="Role">User Role</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Scope Target Identifier</label>
                <input
                  type="text"
                  value={scopeTarget}
                  onChange={(e) => setScopeTarget(e.target.value)}
                  placeholder="e.g. daily_operations_reporting or *"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* 3. Triggers & Conditions */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-slate-600">
                <Sliders className="h-4 w-4 text-teal-600" />
                3. Triggers & Conditions
              </div>
              <button
                type="button"
                onClick={addCondition}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-teal-600 hover:text-teal-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Condition
              </button>
            </div>

            <div>
              <label className={labelClass}>Trigger Event</label>
              <select
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
                className={inputClass}
              >
                <option value="Before Execution">Before Execution</option>
                <option value="After Execution">After Execution</option>
                <option value="On Risk Detection">On Risk Detection</option>
                <option value="On Policy Violation">On Policy Violation</option>
              </select>
            </div>

            {conditions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-[13px] text-slate-400">
                No conditions added. Rules will evaluate on the trigger event only.
              </div>
            ) : (
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Rule Stack (AND)
                </span>
                {conditions.map((cond, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200"
                  >
                    <input
                      type="text"
                      value={cond.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      placeholder="Field (e.g. risk_score)"
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] bg-white"
                    >
                      <option value=">=">≥</option>
                      <option value=">">&gt;</option>
                      <option value="<=">≤</option>
                      <option value="<">&lt;</option>
                      <option value="==">==</option>
                      <option value="!=">!=</option>
                      <option value="contains">contains</option>
                    </select>
                    <input
                      type="text"
                      value={cond.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition self-end sm:self-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Guardrail Type */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-slate-600">
              <Shield className="h-4 w-4 text-teal-600" />
              4. Guardrail Type
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {guardrailTypes.map((item) => {
                const selected = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${selected
                        ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/15'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-900 leading-snug">
                        {item.label}
                      </span>
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                      )}
                    </div>
                    <span className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 5. Type-Specific Config */}
          <section className="rounded-xl border border-teal-200/70 bg-teal-50/25 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-teal-800">
              <Sliders className="h-4 w-4 text-teal-600" />
              5. {type} Configuration
            </div>

            {type === 'HITL' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Approver Type</label>
                  <select
                    value={approverType}
                    onChange={(e) => setApproverType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Role">Role-Based</option>
                    <option value="User">Specific User</option>
                    <option value="Group">Approval Group</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Approver Target</label>
                  <input
                    type="text"
                    value={approverTarget}
                    onChange={(e) => setApproverTarget(e.target.value)}
                    placeholder="e.g. Super Admin"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Approval Sequence</label>
                  <select
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Sequential">Sequential</option>
                    <option value="Parallel">Parallel</option>
                    <option value="Any">Any Approver</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Notification Channel</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Both">Portal & Email</option>
                    <option value="Portal">Portal Only</option>
                    <option value="Email">Email Only</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Timeout (Minutes)</label>
                  <input
                    type="number"
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                    className={inputClass}
                    min={1}
                  />
                </div>
              </div>
            )}

            {type === 'Traceability' && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Logging Targets</label>
                  <div className="flex flex-wrap gap-3">
                    {['LLM Cost', 'Token Usage', 'Tool Calls', 'Input Payload'].map(
                      (item) => (
                        <label
                          key={item}
                          className="inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={loggingTargets.includes(item)}
                            onChange={() => toggleLoggingTarget(item)}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/30"
                          />
                          {item}
                        </label>
                      )
                    )}
                  </div>
                </div>
                <div className="max-w-xs">
                  <label className={labelClass}>Retention Period (Days)</label>
                  <input
                    type="number"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                    className={inputClass}
                    min={1}
                  />
                </div>
              </div>
            )}

            {type === 'RiskBased' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Allow Threshold (&lt;)</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={allowThreshold}
                    onChange={(e) => setAllowThreshold(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Notify Threshold (&lt;)</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={notifyThreshold}
                    onChange={(e) => setNotifyThreshold(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>HITL Threshold (≥)</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={hitlThreshold}
                    onChange={(e) => setHitlThreshold(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {type === 'LimitTime' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Max Token Limit</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className={inputClass}
                    min={1}
                  />
                </div>
                <div>
                  <label className={labelClass}>Max Cost (USD)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={maxCostUsd}
                    onChange={(e) => setMaxCostUsd(Number(e.target.value))}
                    className={inputClass}
                    min={0}
                  />
                </div>
                <div>
                  <label className={labelClass}>Active Hours</label>
                  <input
                    type="text"
                    value={activeHours}
                    onChange={(e) => setActiveHours(e.target.value)}
                    placeholder="00:00-23:59"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {type === 'AccessControl' && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-[13px] text-slate-600">
                Deterministic security firewall is active for matching queries and injection threats.
              </div>
            )}

            {type === 'DataPrivacy' && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-[13px] text-slate-600">
                Automatic PII, credit-card, and sensitive configuration term redaction is enabled.
              </div>
            )}
          </section>

          {/* 6. Execution Behavior */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-wider text-slate-600">
              <Lock className="h-4 w-4 text-teal-600" />
              6. Execution Behavior & Failure Strategy
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Trigger Action</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className={inputClass}
                >
                  <option value="Allow">Allow</option>
                  <option value="Require HITL">Require HITL Approval</option>
                  <option value="Block">Block Execution</option>
                  <option value="Escalate">Escalate to Admin</option>
                  <option value="Redact">Redact Sensitive Payload</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Failure Strategy</label>
                <select
                  value={failureMode}
                  onChange={(e) => setFailureMode(e.target.value)}
                  className={inputClass}
                >
                  <option value="Fail Closed">
                    Fail Closed (Block on evaluation error)
                  </option>
                  <option value="Fail Open">
                    Fail Open (Allow on evaluation error)
                  </option>
                </select>
              </div>

              {isEditing && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Audit Change Reason</label>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Provide reason for this policy modification…"
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          </section>
        </form>

        {/* Sticky Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="guardrail-form"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition shadow-sm"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving
              ? 'Saving…'
              : isEditing
                ? 'Update Policy'
                : 'Create Policy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuardrailFormModal;