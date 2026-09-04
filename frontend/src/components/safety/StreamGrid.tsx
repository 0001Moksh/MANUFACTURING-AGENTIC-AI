import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface Device {
  id: number;
  name: string;
  ip: string;
  port: number;
  camera_number: string;
  user_id?: string;
  status: string;
  rtsp_url?: string;
  stream_url?: string;
}

interface CameraStats {
  critical: number;
  warning: number;
  normal: number;
}

type LayoutMode = 'grid' | 'single';

const Icon = {
  Search: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </svg>
  ),
  Refresh: ({ spinning }: { spinning?: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={spinning ? 'animate-spin' : ''}>
      <path d="M21 12a9 9 0 11-3-6.7" strokeLinecap="round" /><path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Grid: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  Single: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
    </svg>
  ),
  Expand: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M3 16v3a2 2 0 002 2h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Close: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  Camera: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  Warn: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01M10.29 3.86l-8.4 14.55A1.5 1.5 0 003.19 21h17.62a1.5 1.5 0 001.3-2.59l-8.4-14.55a1.5 1.5 0 00-2.6 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Chevron: ({ open }: { open: boolean }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export const StreamGrid: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [streamErrors, setStreamErrors] = useState<Record<number, string>>({});
  const [imgLoaded, setImgLoaded] = useState<Record<number, boolean>>({});

  const [query, _setQuery] = useState('');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [fullscreenId, setFullscreenId] = useState<number | null>(null);
  const [snapshotFlash, setSnapshotFlash] = useState<number | null>(null);

  // Expand / Collapse state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Mock per-camera stats (replace later with real API)
  const [cameraStats] = useState<Record<number, CameraStats>>({
    // will be filled dynamically if needed
  });

  const imgRefs = useRef<Record<number, HTMLImageElement | null>>({});

  const fetchDevices = useCallback((silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    fetch('/api/video-monitoring/devices')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Device[]) => {
        setDevices(data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(() => {
        setError('Database Connection Unavailable or Unable to reach Video Analytics backend.');
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => fetchDevices(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // clear loaded state when collapsing so it reloads next time
        setImgLoaded(p => {
          const c = { ...p };
          delete c[id];
          return c;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(devices.map(d => d.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
    setImgLoaded({});
  };

  const handleStreamError = (id: number) => setStreamErrors(prev => ({ ...prev, [id]: 'STREAM UNAVAILABLE' }));

  const retryStream = (id: number) => {
    setStreamErrors(prev => { const c = { ...prev }; delete c[id]; return c; });
    setImgLoaded(prev => ({ ...prev, [id]: false }));
  };

  const takeSnapshot = (device: Device) => {
    const img = imgRefs.current[device.id];
    if (!img) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = `${device.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setSnapshotFlash(device.id);
      setTimeout(() => setSnapshotFlash(null), 400);
    } catch (e) {
      console.error('Snapshot failed (likely CORS on the stream):', e);
    }
  };

  const filteredDevices = useMemo(() => {
    if (!query) return devices;
    const q = query.toLowerCase();
    return devices.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.camera_number.toLowerCase().includes(q) ||
      d.ip.toLowerCase().includes(q)
    );
  }, [devices, query]);

  const fullscreenDevice = devices.find(d => d.id === fullscreenId) || null;

  // Simple mock stats generator (replace with real data later)
  const getStats = (id: number): CameraStats => {
    if (cameraStats[id]) return cameraStats[id];
    // deterministic mock based on id
    return {
      critical: (id * 3) % 7,
      warning: (id * 5) % 12,
      normal: (id * 2) % 9,
    };
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-white border border-slate-200 text-slate-600 p-8 rounded-xl flex items-center justify-center min-h-[300px] shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium text-sm">Querying construction_ai database &amp; decrypting camera credentials...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 text-red-500">
          <Icon.Warn />
        </div>
        <h3 className="font-bold text-lg mb-1 text-red-700">Error Loading Devices</h3>
        <p className="text-sm text-red-600/80 text-center max-w-md mb-4">{error}</p>
        <button
          onClick={() => fetchDevices()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-white border border-slate-200 text-slate-500 rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-slate-800">No Cameras Found</h3>
        <p className="text-sm">No active camera configurations were returned from construction_ai.</p>
      </div>
    );
  }

  const renderCard = (device: Device) => {
    const isExpanded = expandedIds.has(device.id);
    const streamErr = streamErrors[device.id];
    const streamSrc = device.stream_url || `/api/video-monitoring/stream/${device.id}`;
    const loaded = !!imgLoaded[device.id];
    const stats = getStats(device.id);

    return (
      <div key={device.id} className="bg-white rounded-xl overflow-hidden shadow-md border border-slate-200 flex flex-col">
        {/* Header - always visible */}
        <div
          className="px-4 py-2.5 bg-slate-50 text-slate-900 flex justify-between items-center text-sm border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => toggleExpand(device.id)}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="font-bold text-slate-800 truncate">{device.name}</span>
            <span className="text-xs text-slate-600 bg-slate-200 px-2 py-0.5 rounded font-mono whitespace-nowrap">
              CAM-{device.camera_number}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">

            {!streamErr && isExpanded && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                LIVE
              </span>
            )}

            <span className="text-slate-500">
              <Icon.Chevron open={isExpanded} />
            </span>
          </div>
        </div>

        {/* Collapsed summary */}
        {!isExpanded && (
          <div className="px-4 py-3 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
            <span>Click to expand live feed</span>
            <div className="flex items-center gap-2 sm:hidden">
              <span className="text-red-600">{stats.critical} Crit</span>
              <span className="text-amber-600">{stats.warning} Warn</span>
              <span className="text-emerald-600">{stats.normal} Norm</span>
            </div>
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <>
            <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
              {streamErr ? (
                <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-300 text-xs font-bold rounded-full mb-3 uppercase tracking-wider animate-pulse">
                    Reconnecting · {streamErr}
                  </span>
                  <p className="text-xs text-slate-500 max-w-xs mb-3">
                    Unable to pull stream from RTSP endpoint:{' '}
                    <span className="font-mono text-slate-700">{device.ip}:{device.port}</span>
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); retryStream(device.id); }}
                    className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 rounded transition-colors"
                  >
                    Retry Stream
                  </button>
                </div>
              ) : (
                <div className="relative w-full h-full group">
                  {!loaded && (
                    <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center text-slate-400">
                      <Icon.Camera />
                    </div>
                  )}
                  <img
                    ref={(el) => { imgRefs.current[device.id] = el; }}
                    src={streamSrc}
                    alt={`Live feed for ${device.name}`}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImgLoaded(prev => ({ ...prev, [device.id]: true }))}
                    onError={() => handleStreamError(device.id)}
                    crossOrigin="anonymous"
                  />

                  <button
                    onClick={(e) => { e.stopPropagation(); takeSnapshot(device); }}
                    title="Capture snapshot"
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <Icon.Camera />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); setFullscreenId(device.id); }}
                    title="Expand fullscreen"
                    className="absolute top-3 right-12 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <Icon.Expand />
                  </button>

                  {snapshotFlash === device.id && (
                    <div className="absolute inset-0 bg-white animate-[fadeOut_0.4s_ease_forwards] pointer-events-none"></div>
                  )}

                  {/* {device.rtsp_url && (
                    <div className="absolute bottom-2 left-2 right-2 bg-white/90 border border-slate-200 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-slate-700 truncate">
                      <span className="text-emerald-600 font-bold mr-1.5">RTSP:</span>
                      <span>{device.rtsp_url}</span>
                    </div>
                  )} */}
                </div>
              )}
            </div>

            {/* Footer with counts */}
            <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between text-slate-600 text-xs border-t border-slate-200">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Critical: <b className="text-red-600">{stats.critical}</b>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Warning: <b className="text-amber-600">{stats.warning}</b>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Normal: <b className="text-emerald-600">{stats.normal}</b>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">30 FPS</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <style>{`@keyframes fadeOut { 0% { opacity: 0.7; } 100% { opacity: 0; } }`}</style>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            {devices.length} Cameras Streaming Live
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">


          <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={() => setLayout('grid')}
              title="Grid view"
              className={`w-8 h-8 flex items-center justify-center transition-colors ${layout === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
              <Icon.Grid />
            </button>
            <button
              onClick={() => setLayout('single')}
              title="Single column view"
              className={`w-8 h-8 flex items-center justify-center transition-colors ${layout === 'single' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
              <Icon.Single />
            </button>
          </div>

          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
          >
            Show All Cameras
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
          >
            Collapse All
          </button>

          <button
            onClick={() => fetchDevices(true)}
            title="Refresh camera list"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Icon.Refresh spinning={refreshing} />
          </button>
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="bg-white border border-slate-200 text-slate-500 rounded-xl p-8 text-center text-sm shadow-sm">
          No cameras match &quot;{query}&quot;.
        </div>
      ) : (
        <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>
          {filteredDevices.map(device => renderCard(device))}
        </div>
      )}

      {/* Fullscreen modal */}
      {fullscreenDevice && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
          onClick={() => setFullscreenId(null)}
        >
          <div className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-white font-bold">{fullscreenDevice.name} · CAM-{fullscreenDevice.camera_number}</span>
              <button
                onClick={() => setFullscreenId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-colors"
              >
                <Icon.Close />
              </button>
            </div>
            {renderCard(fullscreenDevice)}
          </div>
        </div>
      )}
    </div>
  );
};