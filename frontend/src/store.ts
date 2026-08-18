import { create } from 'zustand';

export type PersonaType = 'both' | 'mfg' | 'it';

interface UserInfo {
  username: string;
  role: string;
  site: string;
}

interface PlatformState {
  persona: PersonaType;
  setPersona: (persona: PersonaType) => void;
  
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  token: string | null;
  user: UserInfo | null;
  login: (token: string, role: string, site: string, username: string) => void;
  logout: () => void;
  
  telemetryStats: {
    production_output: string;
    plant_oee: string;
    zero_harm_index: string;
    revenue_ytd: string;
    active_work_orders: number;
    in_progress_work_orders: number;
    active_alerts: number;
    running_machines: number;
    total_machines: number;
    mes_db_status?: {
      connected: boolean;
      type: string;
      details: string;
    };
    video_analytics_db_status?: {
      connected: boolean;
      type: string;
      details: string;
    };
  } | null;
  setTelemetryStats: (stats: any) => void;
  
  explainableLogs: boolean;
  setExplainableLogs: (enabled: boolean) => void;
  
  humanInLoop: boolean;
  setHumanInLoop: (enabled: boolean) => void;

  // Fetches governance settings from the backend and syncs to store
  fetchGovernanceSettings: () => Promise<void>;
  // Toggles a specific governance setting via API and updates store
  toggleGovernanceSetting: (setting_key: string, enabled: boolean) => Promise<void>;

  reportingAgentState: {
    query: string;
    model: string;
    status: 'idle' | 'running' | 'success' | 'requires_approval' | 'error';
    result: any;
    errorMsg: string;
    showLogs: boolean;
  };
  setReportingAgentState: (state: Partial<PlatformState['reportingAgentState']>) => void;
  resetReportingAgentState: () => void;
}

const defaultReportingAgentState = {
  query: '',
  model: 'auto',
  status: 'idle' as const,
  result: null,
  errorMsg: '',
  showLogs: false,
};

export const useStore = create<PlatformState>((set) => {
  const rawToken = localStorage.getItem('token');
  const token = (rawToken === 'null' || rawToken === 'undefined' || !rawToken) ? null : rawToken;

  return {
    persona: 'both',
    setPersona: (persona) => set({ persona }),
    
    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    
    token: token,
    user: token ? {
      username: localStorage.getItem('username') || '',
      role: localStorage.getItem('role') || 'Guest',
      site: localStorage.getItem('site') || 'Unknown Site',
    } : null,
    
    login: (tokenVal, role, site, username) => {
      localStorage.setItem('token', tokenVal);
      localStorage.setItem('role', role);
      localStorage.setItem('site', site);
      localStorage.setItem('username', username);
      set({ token: tokenVal, user: { username, role, site } });
    },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('site');
    localStorage.removeItem('username');
    set({ token: null, user: null });
  },
  
  telemetryStats: null,
  setTelemetryStats: (telemetryStats) => set({ telemetryStats }),
  
  explainableLogs: true,
  setExplainableLogs: (enabled) => set({ explainableLogs: enabled }),
  
  humanInLoop: false,
  setHumanInLoop: (enabled) => set({ humanInLoop: enabled }),

  fetchGovernanceSettings: async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/governance/settings');
      if (!res.ok) return;
      const settings: { setting_key: string; is_enabled: boolean }[] = await res.json();
      const explainability = settings.find(s => s.setting_key === 'explainability_logging');
      const hitl = settings.find(s => s.setting_key === 'hitl_approval');
      set({
        explainableLogs: explainability ? explainability.is_enabled : true,
        humanInLoop: hitl ? hitl.is_enabled : false,
      });
    } catch (e) {
      // Silently fail — defaults remain in store
      console.warn('[Store] Could not fetch governance settings:', e);
    }
  },

  toggleGovernanceSetting: async (setting_key, enabled) => {
    // Optimistically update local state first
    if (setting_key === 'explainability_logging') set({ explainableLogs: enabled });
    if (setting_key === 'hitl_approval') set({ humanInLoop: enabled });
    try {
      await fetch('http://localhost:8000/api/admin/governance/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setting_key, enabled }),
      });
    } catch (e) {
      // Revert on failure
      console.error('[Store] Failed to persist governance setting:', e);
      if (setting_key === 'explainability_logging') set({ explainableLogs: !enabled });
      if (setting_key === 'hitl_approval') set({ humanInLoop: !enabled });
    }
  },

  reportingAgentState: defaultReportingAgentState,
  setReportingAgentState: (partialState) =>
    set((state) => ({
      reportingAgentState: { ...state.reportingAgentState, ...partialState },
    })),
  resetReportingAgentState: () =>
    set({ reportingAgentState: defaultReportingAgentState }),
  };
});
