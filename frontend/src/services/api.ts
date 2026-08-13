import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

// Create Axios Instance
export const api = axios.create({
  baseURL: API_BASE,
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
  }
};

export const agentService = {
  query: async (query: string, model: string = 'gemini-3.5-flash-lite') => {
    const res = await api.post('/agent/query', { query, model });
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
