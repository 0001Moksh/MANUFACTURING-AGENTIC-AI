// Use the current origin so LAN clients reach the host's Vite/Nginx API proxy.
const fallbackApiBaseUrl = '/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl).replace(/\/$/, '');

export const backendUrl = (path: string) => {
  const configuredBase = new URL(API_BASE_URL, window.location.origin);
  const isLocalBackend = ['localhost', '127.0.0.1', '0.0.0.0'].includes(configuredBase.hostname);
  const isRemoteFrontend = !['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
  const backendOrigin = isLocalBackend && isRemoteFrontend
    ? window.location.origin
    : configuredBase.origin;
  return new URL(path, backendOrigin).toString();
};

export const reportPdfUrl = (source?: string | null) => {
  if (!source) return '';
  let pathname = source;
  try {
    pathname = new URL(source, window.location.origin).pathname;
  } catch {
    pathname = source.split(/[?#]/, 1)[0];
  }

  let filename = pathname.split('/').filter(Boolean).pop() || '';
  try {
    filename = decodeURIComponent(filename);
  } catch {
    return '';
  }
  if (!/^[\w.-]+\.pdf$/i.test(filename)) return '';
  return backendUrl(`/reports/${encodeURIComponent(filename)}`);
};

export const websocketUrl = (path: string) => {
  const baseUrl = new URL(API_BASE_URL, window.location.origin);
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  return baseUrl.toString();
};
