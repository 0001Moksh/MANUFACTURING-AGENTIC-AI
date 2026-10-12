import React, { useCallback, useState } from 'react';

export interface AgentOption {
  key: string;
  label: string;
  hint: string;
}

// Keys must match AGENT_SPECS in backend voice_agent_graph.py
export const AGENT_OPTIONS: AgentOption[] = [
  { key: 'ppe_vision', label: 'PPE & Behavior Vision', hint: 'Helmet/vest violations, alerts, zones, cameras' },
  { key: 'permit_to_work', label: 'Permit-to-Work', hint: 'Hot work, confined space, height, escalation' },
  { key: 'safety_quality', label: 'Safety & Quality', hint: 'Inspections, defects, quality holds, vendors' },
  { key: 'incident_investigation', label: 'Incident & Investigation', hint: 'TRIR, LTIFR, spills, fatigue, anomalies' },
  { key: 'maintenance', label: 'Maintenance', hint: 'Machine health, work orders, MES alerts' },
  { key: 'general', label: 'General Assistant', hint: 'Calculator, time, other plant questions' },
];

const ALL_KEYS = AGENT_OPTIONS.map((option) => option.key);
const STORAGE_KEY = 'deva.voice.enabledAgents';

const readStored = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_KEYS;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return ALL_KEYS.filter((key) => parsed.includes(key));
  } catch {
    // corrupted / blocked storage: fall back to everything enabled
  }
  return ALL_KEYS;
};

/** Enabled agent keys, persisted in localStorage so the choice survives page reloads. */
export const useEnabledAgents = () => {
  const [enabledAgents, setState] = useState<string[]>(readStored);

  const setEnabledAgents = useCallback((next: string[]) => {
    const clean = ALL_KEYS.filter((key) => next.includes(key));
    setState(clean);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // storage unavailable: selection still works for this session
    }
  }, []);

  return { enabledAgents, setEnabledAgents };
};

interface AgentSelectorProps {
  enabled: string[];
  onChange: (next: string[]) => void;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({ enabled, onChange }) => {
  const [open, setOpen] = useState(true);
  const enabledSet = new Set(enabled);

  const toggle = (key: string) => {
    onChange(enabledSet.has(key) ? enabled.filter((k) => k !== key) : [...enabled, key]);
  };

  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <span className=" text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Active Agents
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5  text-[10px] font-semibold text-slate-600">
            {enabled.length}/{AGENT_OPTIONS.length}
          </span>
          <span className="text-[10px] text-slate-400">{open ? '▾' : '▸'}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(ALL_KEYS)}
            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            None
          </button>
        </div>
      </div>

      {open && (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {AGENT_OPTIONS.map((option) => {
            const on = enabledSet.has(option.key);
            return (
              <li key={option.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={`truncate text-[13px] font-semibold ${on ? 'text-slate-800' : 'text-slate-400'}`}>
                    {option.label}
                  </div>
                  <div className="truncate text-[10px] italic text-slate-400">{option.hint}</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`Toggle ${option.label}`}
                  onClick={() => toggle(option.key)}
                  className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      on ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {enabled.length === 0 && (
        <p className="m-0 mt-2 text-[10px] italic text-amber-600">
          All agents are off, so Deva can only chat. Plant data questions will not be answered.
        </p>
      )}
    </div>
  );
};