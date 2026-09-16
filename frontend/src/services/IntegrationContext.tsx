import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { agents } from '../data/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationConfigItem {
  id?: number;
  name: string;
  is_enabled: boolean;
  server_url?: string;
  api_token?: string;
  org_id?: number;
  status?: 'CONNECTED' | 'DISCONNECTED' | 'UNTESTED' | string;
  last_checked_at?: string | null;
  details?: string | null;
}

export interface IntegrationTestResult {
  success: boolean;
  status: string;
  message: string;
  latency_ms: number;
  details?: any;
}

export interface IntegrationState {
  /** List of complete integration records */
  integrations: IntegrationConfigItem[];
  /** Map of integration name → is_enabled, e.g. { MES: true, "Video Analytics": false, "Grafana IoT Application": true } */
  integrationStates: Record<string, boolean>;
  /** Map of agent name → is_enabled, e.g. { "Operations Agent": true } */
  agentStates: Record<string, boolean>;
  /** True while initial fetch is in-flight */
  loading: boolean;
  /** Refresh integration list from backend */
  fetchIntegrations: () => Promise<void>;
  /** Test connection to an integration target */
  testIntegrationConnection: (payload: {
    integration_type: string;
    server_url?: string;
    api_token?: string;
    service_account_token?: string;
    org_id?: number;
  }) => Promise<IntegrationTestResult>;
  /** Save integration configuration */
  saveIntegrationConfig: (payload: {
    name: string;
    is_enabled?: boolean;
    server_url?: string;
    api_token?: string;
    org_id?: number;
  }) => Promise<{ success: boolean; message: string; integration?: IntegrationConfigItem }>;
  /** Toggle an integration and persist via the backend */
  toggleIntegration: (name: string, currentState: boolean) => Promise<void>;
  /** Toggle an agent state */
  toggleAgentState: (agentName: string, enabled?: boolean) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const IntegrationContext = createContext<IntegrationState>({
  integrations: [],
  integrationStates: {},
  agentStates: {},
  loading: true,
  fetchIntegrations: async () => {},
  testIntegrationConnection: async () => ({ success: false, status: 'DISCONNECTED', message: 'Not implemented', latency_ms: 0 }),
  saveIntegrationConfig: async () => ({ success: false, message: 'Not implemented' }),
  toggleIntegration: async () => {},
  toggleAgentState: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const IntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [integrations, setIntegrations] = useState<IntegrationConfigItem[]>([]);
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

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations`);
      if (res.ok) {
        const data: IntegrationConfigItem[] = await res.json();
        setIntegrations(data);
        const states: Record<string, boolean> = {};
        data.forEach(d => {
          states[d.name] = d.is_enabled;
        });
        setIntegrationStates(states);
      }
    } catch (err) {
      console.warn('[IntegrationContext] Could not load integrations:', err);
      // Default fallback
      setIntegrationStates({
        MES: true,
        'Video Analytics': true,
        'Grafana IoT Application': true,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const testIntegrationConnection = useCallback(async (payload: {
    integration_type: string;
    server_url?: string;
    api_token?: string;
    service_account_token?: string;
    org_id?: number;
  }): Promise<IntegrationTestResult> => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: IntegrationTestResult = await res.json();
      // Refresh integrations list so persisted statuses update in state
      fetchIntegrations();
      return data;
    } catch (err: any) {
      return {
        success: false,
        status: 'DISCONNECTED',
        message: err?.message || 'Network request failed while testing integration',
        latency_ms: 0,
      };
    }
  }, [fetchIntegrations]);

  const saveIntegrationConfig = useCallback(async (payload: {
    name: string;
    is_enabled?: boolean;
    server_url?: string;
    api_token?: string;
    org_id?: number;
  }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/integrations/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchIntegrations();
        return { success: true, message: data.message || 'Configuration saved', integration: data.integration };
      }
      const err = await res.json();
      return { success: false, message: err.detail || 'Failed to save configuration' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to connect to server' };
    }
  }, [fetchIntegrations]);

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
        setIntegrations(prev =>
          prev.map(item => (item.name.toLowerCase().includes(name.toLowerCase()) ? { ...item, is_enabled: newState } : item))
        );
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
    <IntegrationContext.Provider
      value={{
        integrations,
        integrationStates,
        agentStates,
        loading,
        fetchIntegrations,
        testIntegrationConnection,
        saveIntegrationConfig,
        toggleIntegration,
        toggleAgentState,
      }}
    >
      {children}
    </IntegrationContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Consume integration & agent states from anywhere in the component tree. */
export const useIntegrations = (): IntegrationState => useContext(IntegrationContext);


