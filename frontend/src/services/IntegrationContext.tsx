import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { agents } from '../data/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationState {
  /** Map of integration name → is_enabled, e.g. { MES: true, "Video Analytics": false } */
  integrationStates: Record<string, boolean>;
  /** Map of agent name → is_enabled, e.g. { "Operations Agent": true } */
  agentStates: Record<string, boolean>;
  /** True while the initial fetch is in-flight */
  loading: boolean;
  /** Toggle an integration and persist via the backend */
  toggleIntegration: (name: string, currentState: boolean) => Promise<void>;
  /** Toggle an agent state */
  toggleAgentState: (agentName: string, enabled?: boolean) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const IntegrationContext = createContext<IntegrationState>({
  integrationStates: {},
  agentStates: {},
  loading: true,
  toggleIntegration: async () => {},
  toggleAgentState: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const IntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [integrationStates, setIntegrationStates] = useState<Record<string, boolean>>({});
  const [agentStates, setAgentStates] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('mai_agent_states');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Initial default: all agents enabled
    const initial: Record<string, boolean> = {};
    agents.forEach(a => { initial[a.n] = true; });
    return initial;
  });
  const [loading, setLoading] = useState(true);

  // Fetch all integration states once on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/integrations`)
      .then(r => r.json())
      .then((data: { name: string; is_enabled: boolean }[]) => {
        const states: Record<string, boolean> = {};
        data.forEach(d => (states[d.name] = d.is_enabled));
        setIntegrationStates(states);
      })
      .catch(err => {
        console.warn('[IntegrationContext] Could not load integration states:', err);
        // Default to enabled so the app remains functional when backend is offline
        setIntegrationStates({ MES: true, 'Video Analytics': true });
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleIntegration = useCallback(async (name: string, currentState: boolean) => {
    const newState = !currentState;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled: newState }),
      });
      if (res.ok) {
        setIntegrationStates(prev => ({ ...prev, [name]: newState }));
      }
    } catch (e) {
      console.error('[IntegrationContext] Failed to toggle integration:', e);
    }
  }, []);

  const toggleAgentState = useCallback(async (agentName: string, enabled?: boolean) => {
    setAgentStates(prev => {
      const nextState = enabled !== undefined ? enabled : !(prev[agentName] ?? true);
      const updated = { ...prev, [agentName]: nextState };
      try {
        localStorage.setItem('mai_agent_states', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await fetch(`${API_BASE_URL}/admin/agents/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentName, enabled }),
      });
    } catch (e) {
      // API optional fallback
    }
  }, []);

  return (
    <IntegrationContext.Provider value={{ integrationStates, agentStates, loading, toggleIntegration, toggleAgentState }}>
      {children}
    </IntegrationContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Consume integration & agent states from anywhere in the component tree. */
export const useIntegrations = (): IntegrationState => useContext(IntegrationContext);

