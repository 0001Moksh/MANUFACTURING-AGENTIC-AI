import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Create Axios Instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure auth header interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Configure response interceptor to redirect on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('site');
      localStorage.removeItem('username');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// --- API SERVICES ---

export const authService = {
  login: async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.access_token) {
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('role', res.data.role);
      localStorage.setItem('site', res.data.site);
      localStorage.setItem('username', username);
    }
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('site');
    localStorage.removeItem('username');
  },
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
  getUser: () => {
    return {
      username: localStorage.getItem('username') || '',
      role: localStorage.getItem('role') || 'Guest',
      site: localStorage.getItem('site') || 'Unknown Site',
    };
  }
};

export const telemetryService = {
  getStats: async () => {
    const res = await api.get('/telemetry');
    return res.data;
  },
  getMachineMonitoring: async () => {
    const res = await api.get('/machine-monitoring/telemetry');
    return res.data;
  }
};

export const machineMonitoringService = {
  getInfluxBuckets: async () => {
    const res = await api.get('/influx/buckets');
    return res.data;
  },
  setInfluxBucket: async (bucket: string) => {
    const res = await api.post('/influx/buckets', { bucket });
    return res.data;
  },
  getAi: async (machineId: string) => {
    const res = await api.get(`/machines/${encodeURIComponent(machineId)}/ai`);
    return res.data;
  },
  recordOperatorAction: async (machineId: string, issueId: number, action: string) => {
    const res = await api.post(`/machines/${encodeURIComponent(machineId)}/issues/${issueId}/operator-action`, { action });
    return res.data;
  },
  getThresholds: async (machineId: string) => {
    const res = await api.get(`/v1/mai/thresholds/${encodeURIComponent(machineId)}`);
    return res.data;
  },
  saveThresholds: async (machineId: string, parameters: Record<string, Record<string, number | null>>) => {
    const res = await api.post(`/v1/mai/thresholds/${encodeURIComponent(machineId)}`, { parameters });
    return res.data;
  },
  regenerateSummary: async (machineId: string) => {
    const res = await api.post(`/machines/${encodeURIComponent(machineId)}/ai-summary/regenerate`);
    return res.data;
  },
  ignoreIssue: async (machineId: string, issueId: number, notes?: string) => {
    const res = await api.post(`/machines/${encodeURIComponent(machineId)}/issues/${issueId}/ignore`, { notes });
    return res.data;
  },
  getIssueHistory: async (machineId: string) => {
    const res = await api.get(`/machines/${encodeURIComponent(machineId)}/issues/history`);
    return res.data;
  },
  getDocuments: async (machineId: string) => {
    const res = await api.get(`/machines/${encodeURIComponent(machineId)}/documents`);
    return res.data;
  },
  uploadDocument: async (machineId: string, file: File, title: string, documentType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('document_type', documentType);
    const res = await api.post(`/machines/${encodeURIComponent(machineId)}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  updateDocument: async (machineId: string, documentId: number, title: string, documentType: string) => {
    const res = await api.patch(`/machines/${encodeURIComponent(machineId)}/documents/${documentId}`, {
      title,
      document_type: documentType,
    });
    return res.data;
  },
  deleteDocument: async (machineId: string, documentId: number) => {
    await api.delete(`/machines/${encodeURIComponent(machineId)}/documents/${documentId}`);
  },
  getDocumentFile: async (machineId: string, documentId: number, download = false) => {
    const res = await api.get(
      `/machines/${encodeURIComponent(machineId)}/documents/${documentId}/content${download ? '?download=true' : ''}`,
      { responseType: 'blob' }
    );
    return res.data as Blob;
  },
  queryDocumentKb: async (machineId: string, query: string) => {
    const res = await api.post(`/machines/${encodeURIComponent(machineId)}/documents/query`, { query });
    return res.data;
  },
};

export const licenseService = {
  getStatus: async () => {
    const res = await api.get('/license/status');
    return res.data;
  },
  verify: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/license/verify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export const agentService = {
  query: async (query: string, model: string = 'auto', agent: string = 'reporting') => {
    const res = await api.post('/agent/query', { query, model, agent });
    return res.data;
  },
  approve: async (state: any) => {
    const res = await api.post('/agent/approve', { state });
    return res.data;
  },
  toggleAgent: async (name: string, enabled: boolean) => {
    const res = await api.post('/admin/agents/toggle', { name, enabled });
    return res.data;
  }
};

export const reportApprovalService = {
  decide: async (approvalKey: string, decision: 'approve' | 'reject', note: string = '') => {
    const res = await api.post(`/report-approvals/${approvalKey}/${decision}`, { note });
    return res.data;
  },
};

export const adminService = {
  getUsers: async () => {
    const res = await api.get('/admin/users');
    return res.data;
  },
  getConnectors: async () => {
    const res = await api.get('/admin/connectors');
    return res.data;
  },
  getRules: async () => {
    const res = await api.get('/admin/rules');
    return res.data;
  },
  createRule: async (condition: string, action: string) => {
    const res = await api.post('/admin/rules', { condition, action });
    return res.data;
  },
  getAuditLogs: async () => {
    const res = await api.get('/admin/audit');
    return res.data;
  }
};

export const pluginService = {
  list: async () => {
    try {
      const res = await api.get('/plugins');
      return res.data;
    } catch {
      return [
        {
          id: 'telegraf-cpu-monitoring',
          name: 'Telegraf CPU Monitoring',
          slug: 'telegraf-cpu-monitoring',
          version: '1.0.0',
          category: 'Monitoring',
          short_description: 'Collects live CPU utilization and health metrics via Telegraf.',
          detailed_description: 'Collects CPU utilization, per-core metrics, and host health from the target system.',
          icon: 'cpu',
          target_os: 'linux-rpm',
          supported_os: ['linux-rpm'],
          supported_architectures: ['x86_64', 'arm64'],
          tags: ['telegraf', 'cpu', 'infrastructure'],
          capabilities: [
            { id: 'cpu.live_metrics', name: 'Live CPU Metrics' },
            { id: 'cpu.historical_trends', name: 'Historical Trends' },
            { id: 'cpu.threshold_alerts', name: 'Threshold Alerts' },
            { id: 'cpu.agent_analysis', name: 'AI-Based CPU Analysis' }
          ],
          use_cases: ['CPU Monitoring', 'CPU Trends & Analytics', 'High CPU Alerts', 'AI-Based CPU Analysis'],
          setup_modes: ['Download and confirm'],
          published: true,
          enabled: true,
          added_to_view: false,
          installation_status: 'not_registered',
          connection_status: 'not_configured',
          last_metric_received: null,
          installer: { filename: '', size_bytes: 0, checksum_sha256: '', status: 'not_uploaded' },
          overall_installer: { filename: '', size_bytes: 0, checksum_sha256: '', status: 'not_generated' },
          versions: [],
        }
      ];
    }
  },
  getById: async (pluginId: string) => {
    const res = await api.get(`/plugins/${encodeURIComponent(pluginId)}`);
    return res.data;
  },
  getCapabilities: async (pluginId: string) => {
    const res = await api.get(`/plugins/${encodeURIComponent(pluginId)}/capabilities`);
    return res.data;
  },
  register: async (payload: FormData) => {
    const res = await api.post('/admin/plugins', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
  remove: async (pluginId: string) => {
    const res = await api.delete(`/admin/plugins/${encodeURIComponent(pluginId)}`);
    return res.data;
  },
  getCurrentSystem: async () => {
    const res = await api.get('/plugins/system/current');
    return res.data;
  },
  downloadUrl: (pluginId: string) => `${API_BASE_URL}/plugins/${encodeURIComponent(pluginId)}/download`,
  downloadBundle: async (pluginId: string) => {
    const res = await api.get(`/plugins/${encodeURIComponent(pluginId)}/download`, { responseType: 'blob' });
    const disposition = String(res.headers['content-disposition'] || '');
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    return { blob: res.data as Blob, filename: encodedName ? decodeURIComponent(encodedName) : plainName };
  },
  update: async (pluginId: string, payload: Record<string, unknown>) => {
    const res = await api.put(`/admin/plugins/${encodeURIComponent(pluginId)}`, payload);
    return res.data;
  },
  setStatus: async (pluginId: string, payload: Record<string, unknown>) => {
    const res = await api.patch(`/admin/plugins/${encodeURIComponent(pluginId)}/status`, payload);
    return res.data;
  },
  validateConfig: async (pluginId: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/plugins/${encodeURIComponent(pluginId)}/config/validate`, payload);
    return res.data;
  },
  preflight: async (pluginId: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/plugins/${encodeURIComponent(pluginId)}/preflight`, payload);
    return res.data;
  },
  test: async (pluginId: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/plugins/${encodeURIComponent(pluginId)}/test`, payload);
    return res.data;
  },
  getMemoryUtilization: async (minutes = 30, limit = 5000, signal?: AbortSignal) => {
    const res = await api.get('/plugins/telegraf-memory-monitoring/memory-utilization', {
      params: { minutes, limit }, signal, timeout: 15000,
    });
    return res.data;
  },
  getCpuUtilization: async (minutes = 30, limit = 5000, signal?: AbortSignal) => {
    const res = await api.get('/plugins/telegraf-cpu-monitoring/cpu-utilization', {
      params: { minutes, limit },
      signal,
      timeout: 15000,
    });
    return res.data;
  },
  install: async (pluginId: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/plugins/${encodeURIComponent(pluginId)}/installations`, payload);
    return res.data;
  },
  getJob: async (jobId: string) => {
    const res = await api.get(`/plugins/jobs/${encodeURIComponent(jobId)}`);
    return res.data;
  },
};

export const guardrailPolicyService = {
  getPolicies: async () => {
    const res = await api.get('/admin/guardrail-policies');
    return res.data;
  },
  createPolicy: async (data: any) => {
    const res = await api.post('/admin/guardrail-policies', data);
    return res.data;
  },
  updatePolicy: async (id: number, data: any) => {
    const res = await api.put(`/admin/guardrail-policies/${id}`, data);
    return res.data;
  },
  togglePolicy: async (id: number) => {
    const res = await api.patch(`/admin/guardrail-policies/${id}/toggle`);
    return res.data;
  },
  deletePolicy: async (id: number) => {
    const res = await api.delete(`/admin/guardrail-policies/${id}`);
    return res.data;
  },
  evaluate: async (context: any) => {
    const res = await api.post('/admin/guardrail-policies/evaluate', context);
    return res.data;
  }
};
