import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { X, Edit2, Check, Settings2, Mail, Loader2 } from 'lucide-react';

interface UseCaseEntry {
  use_case_key: string;
  label: string;
  description: string;
  hitl_enabled: boolean;
  recipient_emails?: string | null;
  global_hitl_enabled: boolean;
  effective_hitl_enabled: boolean;
}

export const HITLSettingsModal: React.FC<{ onClose: () => void; onUpdated?: () => void }> = ({
  onClose,
  onUpdated,
}) => {
  const [items, setItems] = useState<UseCaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftEmails, setDraftEmails] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/admin/governance/hitl-use-cases')
      .then((res) => setItems(res.data || []))
      .catch((e) => console.error('Failed to load HITL use-cases', e))
      .finally(() => setLoading(false));
  }, []);

  const toggleLocal = async (key: string, next: boolean) => {
    setSavingKey(key);
    try {
      const pathKey = key.replace(/_/g, '-');
      await api.put(`/use-cases/${pathKey}/governance`, { enabled: next });
      setItems((prev) =>
        prev.map((p) => (p.use_case_key === key ? { ...p, hitl_enabled: next } : p))
      );
      onUpdated?.();
    } catch (e) {
      console.error('Failed to toggle HITL for', key, e);
    } finally {
      setSavingKey(null);
    }
  };

  const validateEmails = (value: string) => {
    if (!value.trim()) return true;
    const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return parts.every((p) => re.test(p));
  };

  const saveEmails = async (key: string) => {
    if (!validateEmails(draftEmails)) {
      alert('Please enter valid comma-separated email addresses');
      return;
    }
    setSavingKey(key);
    try {
      const pathKey = key.replace(/_/g, '-');
      const current = items.find((i) => i.use_case_key === key);
      await api.put(`/use-cases/${pathKey}/governance`, {
        enabled: current?.hitl_enabled ?? false,
        recipient_emails: draftEmails.trim() || null,
      });
      setItems((prev) =>
        prev.map((p) =>
          p.use_case_key === key
            ? { ...p, recipient_emails: draftEmails.trim() || null }
            : p
        )
      );
      setEditingKey(null);
      onUpdated?.();
    } catch (e) {
      console.error('Failed to save recipient emails for', key, e);
      alert('Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const startEditing = (it: UseCaseEntry) => {
    setEditingKey(it.use_case_key);
    setDraftEmails(it.recipient_emails || '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[820px] max-h-[85vh] flex flex-col overflow-hidden border border-slate-200/80">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900 leading-tight">
                HITL Configuration
              </h2>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Control human-in-the-loop approval per use case
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
              <span className="text-sm">Loading use cases…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Settings2 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No use cases found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => {
                const isEditing = editingKey === it.use_case_key;
                const isSaving = savingKey === it.use_case_key;

                return (
                  <div
                    key={it.use_case_key}
                    className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-4">
                      {/* Left content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[15px] font-semibold text-slate-900 truncate">
                            {it.label}
                          </h3>
                        </div>
                        <p className="text-[13px] text-slate-500 leading-relaxed mb-3">
                          {it.description}
                        </p>

                        {/* Email section */}
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">
                            <Mail className="h-3 w-3" />
                            Approval recipients
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={draftEmails}
                                onChange={(e) => setDraftEmails(e.target.value)}
                                placeholder="email1@company.com, email2@company.com"
                                className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
                              />
                              <button
                                disabled={isSaving}
                                onClick={() => saveEmails(it.use_case_key)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-teal-700 disabled:opacity-60 transition"
                              >
                                {isSaving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Save
                              </button>
                              <button
                                onClick={() => setEditingKey(null)}
                                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] text-slate-700 truncate">
                                {it.recipient_emails ? (
                                  it.recipient_emails
                                ) : (
                                  <span className="italic text-slate-400">
                                    Using verified Super Admin emails
                                  </span>
                                )}
                              </span>
                              <button
                                onClick={() => startEditing(it)}
                                className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition"
                                title="Edit recipients"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side – toggle + status */}
                      <div className="flex flex-col items-end gap-2 pt-0.5">
                        {/* Custom toggle */}
                        <button
                          disabled={isSaving}
                          onClick={() => toggleLocal(it.use_case_key, !it.hitl_enabled)}
                          className={`
                            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
                            transition-colors duration-200 ease-in-out
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${it.hitl_enabled ? 'bg-teal-500' : 'bg-slate-200'}
                          `}
                          role="switch"
                          aria-checked={it.hitl_enabled}
                        >
                          <span
                            className={`
                              pointer-events-none inline-block h-5 w-5 transform rounded-full
                              bg-white shadow ring-0 transition duration-200 ease-in-out
                              ${it.hitl_enabled ? 'translate-x-5' : 'translate-x-0.5'}
                              mt-0.5
                            `}
                          />
                        </button>

                        {/* Status badge */}
                        <span
                          className={`
                            inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium
                            ${!it.global_hitl_enabled
                              ? 'bg-slate-100 text-slate-500'
                              : it.effective_hitl_enabled
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }
                          `}
                        >
                          {!it.global_hitl_enabled
                            ? 'Global OFF'
                            : it.effective_hitl_enabled
                              ? 'Effective'
                              : 'Locally enabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HITLSettingsModal;