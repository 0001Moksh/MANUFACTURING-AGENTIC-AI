// Production Nginx proxies this path to FastAPI; a Vite variable can still override it for development.
const fallbackApiBaseUrl = '/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl).replace(/\/$/, '');

export const websocketUrl = (path: string) => {
  const baseUrl = new URL(API_BASE_URL, window.location.origin);
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  return baseUrl.toString();
};
