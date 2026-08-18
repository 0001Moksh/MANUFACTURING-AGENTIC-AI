import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://localhost:8000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntegrationState {
  /** Map of integration name → is_enabled, e.g. { MES: true, "Video Analytics": false } */
  integrationStates: Record<string, boolean>;
  /** True while the initial fetch is in-flight */
  loading: boolean;
  /** Toggle an integration and persist via the backend */
  toggleIntegration: (name: string, currentState: boolean) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const IntegrationContext = createContext<IntegrationState>({
  integrationStates: {},
  loading: true,
  toggleIntegration: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export const IntegrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [integrationStates, setIntegrationStates] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Fetch all integration states once on mount
  useEffect(() => {
    fetch(`${API_BASE}/admin/integrations`)
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
      const res = await fetch(`${API_BASE}/admin/integrations/toggle`, {
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

  return (
    <IntegrationContext.Provider value={{ integrationStates, loading, toggleIntegration }}>
      {children}
    </IntegrationContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Consume integration states from anywhere in the component tree. */
export const useIntegrations = (): IntegrationState => useContext(IntegrationContext);
