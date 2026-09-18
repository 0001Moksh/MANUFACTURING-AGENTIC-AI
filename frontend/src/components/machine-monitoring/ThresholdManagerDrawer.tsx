import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, X } from 'lucide-react';
import type { LiveMetric } from '../../data/machineMonitoringData';
import { machineMonitoringService } from '../../services/api';

type ThresholdValues = {
  min: number | null;
  max: number | null;
  warning_high: number | null;
  critical_high: number | null;
};

interface ThresholdManagerDrawerProps {
  machineId: string;
  metrics: LiveMetric[];
  onClose: () => void;
  onSaved: () => void;
}

const toNumberOrNull = (value: string): number | null => value.trim() === '' ? null : Number(value);

export const ThresholdManagerDrawer: React.FC<ThresholdManagerDrawerProps> = ({ machineId, metrics, onClose, onSaved }) => {
  const [values, setValues] = useState<Record<string, ThresholdValues>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    machineMonitoringService.getThresholds(machineId)
      .then((response) => {
        const next: Record<string, ThresholdValues> = {};
        metrics.forEach((metric) => {
          const saved = response.parameters?.[metric.key] ?? {};
          next[metric.key] = {
            min: saved.min ?? metric.normalRange?.[0] ?? null,
            max: saved.max ?? metric.normalRange?.[1] ?? null,
            warning_high: saved.warning_high ?? metric.warningThreshold ?? null,
            critical_high: saved.critical_high ?? metric.criticalThreshold ?? null,
          };
        });
        setValues(next);
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load MAI thresholds'));
  }, [machineId, metrics]);

  const update = (key: string, field: keyof ThresholdValues, value: string) => {
    setValues((current) => ({ ...current, [key]: { ...current[key], [field]: toNumberOrNull(value) } }));
  };

  const resetDefaults = () => {
    const defaults: Record<string, ThresholdValues> = {};
    metrics.forEach((metric) => {
      defaults[metric.key] = {
        min: metric.normalRange?.[0] ?? null,
        max: metric.normalRange?.[1] ?? null,
        warning_high: metric.warningThreshold,
        critical_high: metric.criticalThreshold,
      };
    });
    setValues(defaults);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await machineMonitoringService.saveThresholds(machineId, values);
      setEditing(false);
      onSaved();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save MAI thresholds');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div><h2 className="font-head text-lg font-bold text-ink">Threshold Configuration</h2><p className="text-xs text-muted">MAI DB configuration for machine {machineId}</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Close"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={resetDefaults} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"><RotateCcw className="h-3.5 w-3.5" />Reset to Default</button>
          {!editing && <button onClick={() => setEditing(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Edit</button>}
          {editing && <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-teal px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? 'Saving...' : 'Save Thresholds'}</button>}
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {metrics.map((metric) => {
            const threshold = values[metric.key] ?? { min: null, max: null, warning_high: null, critical_high: null };
            return <div key={metric.key} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between"><div className="font-bold text-sm text-ink">{metric.label}</div><div className="font-mono text-[11px] text-muted">{metric.key} | live: {metric.value ?? 'N/A'} {metric.unit}</div></div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(['min', 'max', 'warning_high', 'critical_high'] as const).map((field) => <label key={field} className="text-[11px] font-semibold text-slate-500">{field.replace('_', ' ')}<input disabled={!editing} type="number" value={threshold[field] ?? ''} onChange={(event) => update(metric.key, field, event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-800 disabled:bg-slate-50" /></label>)}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
};
