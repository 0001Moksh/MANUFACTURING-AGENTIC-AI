const fallbackApiBaseUrl = 'http://localhost:8000/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl).replace(/\/$/, '');

export const websocketUrl = (path: string) => {
  const baseUrl = new URL(API_BASE_URL);
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  return baseUrl.toString();
};
