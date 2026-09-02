import React, { useState, useEffect } from 'react';

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

export const StreamGrid: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStreams, setActiveStreams] = useState<Set<number>>(new Set());
  const [streamErrors, setStreamErrors] = useState<Record<number, string>>( {});

  const fetchDevices = () => {
    setLoading(true);
    setError(null);
    fetch('/api/video-monitoring/devices')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Device[]) => {
        setDevices(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading devices from construction_ai:", err);
        setError('Database Connection Unavailable or Unable to reach Video Analytics backend.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const toggleStream = (id: number) => {
    setActiveStreams(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear any error state when disconnecting
        setStreamErrors(e => {
          const updated = { ...e };
          delete updated[id];
          return updated;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStreamError = (id: number) => {
    setStreamErrors(prev => ({
      ...prev,
      [id]: 'STREAM UNAVAILABLE'
    }));
  };

  const retryStream = (id: number) => {
    setStreamErrors(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-900 border border-slate-800 text-slate-300 p-8 rounded-xl flex items-center justify-center min-h-[300px]">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Querying construction_ai database & decrypting camera credentials...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800/60 text-red-300 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center mb-3">
          <span className="text-red-400 font-bold text-xl">!</span>
        </div>
        <h3 className="font-bold text-lg mb-1 text-red-200">Error Loading Devices</h3>
        <p className="text-sm text-red-300/80 text-center max-w-md mb-4">{error}</p>
        <button 
          onClick={fetchDevices}
          className="px-4 py-2 bg-red-800/80 hover:bg-red-700 text-white rounded text-sm font-semibold transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-slate-400 rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px]">
        <h3 className="font-bold text-lg mb-2 text-slate-200">No Cameras Found</h3>
        <p className="text-sm">No active camera configurations were returned from construction_ai.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {devices.map(device => {
        const isStreaming = activeStreams.has(device.id);
        const streamErr = streamErrors[device.id];
        const streamSrc = device.stream_url || `/api/video-monitoring/stream/${device.id}`;
        
        return (
          <div key={device.id} className="bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-800 flex flex-col">
            {/* Camera Header Bar */}
            <div className="px-4 py-2.5 bg-slate-950 text-white flex justify-between items-center text-sm border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-bold text-slate-100">{device.name}</span>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-mono">
                  CAM-{device.camera_number}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  device.status === 'online' || device.status === 'active'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                    : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                }`}>
                  {device.status?.toUpperCase() || 'ONLINE'}
                </span>
              </div>
            </div>
            
            {/* Stream Viewport Container */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {isStreaming ? (
                streamErr ? (
                  /* Non-blocking error/reconnecting badge overlay */
                  <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                    <span className="px-3 py-1 bg-amber-950 text-amber-400 border border-amber-800 text-xs font-bold rounded-full mb-3 uppercase tracking-wider animate-pulse">
                      ● RECONNECTING / {streamErr}
                    </span>
                    <p className="text-xs text-slate-400 max-w-xs mb-3">
                      Unable to pull stream from target RTSP endpoint: <span className="font-mono text-slate-300">{device.ip}:{device.port}</span>
                    </p>
                    <button 
                      onClick={() => retryStream(device.id)}
                      className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded transition-colors"
                    >
                      Retry Stream
                    </button>
                  </div>
                ) : (
                  /* Active Live Video Feed */
                  <div className="relative w-full h-full group">
                    <img 
                      src={streamSrc} 
                      alt={`Live feed for ${device.name}`}
                      className="w-full h-full object-cover"
                      onError={() => handleStreamError(device.id)}
                    />
                    
                    {/* Live indicator overlay badge */}
                    <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center space-x-1 uppercase tracking-wider backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      <span>LIVE</span>
                    </div>

                    {/* Encrypted/Decrypted RTSP URL Telemetry Overlay */}
                    {device.rtsp_url && (
                      <div className="absolute bottom-2 left-2 right-2 bg-slate-950/80 border border-slate-800/80 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 truncate">
                        <span className="text-emerald-400 font-bold mr-1.5">RTSP:</span>
                        <span>{device.rtsp_url}</span>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* Offline / Feed Standby View */
                <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <button 
                    onClick={() => toggleStream(device.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors shadow-lg shadow-emerald-900/30 flex items-center space-x-2"
                  >
                    <span>Show Live Feed</span>
                  </button>
                  <span className="text-xs text-slate-500 font-mono">{device.ip}:{device.port}</span>
                </div>
              )}
            </div>
            
            {/* Footer Control Panel */}
            <div className="px-4 py-2.5 bg-slate-950 flex items-center justify-between text-slate-400 text-xs border-t border-slate-800">
              <span className="font-mono text-slate-500 truncate max-w-[200px]">
                {device.user_id ? `User: ${device.user_id}` : 'No auth required'}
              </span>

              {isStreaming && (
                <button 
                  onClick={() => toggleStream(device.id)}
                  className="text-red-400 hover:text-red-300 font-bold uppercase tracking-wider text-[11px] bg-red-950/40 border border-red-900/40 px-2.5 py-1 rounded transition-colors"
                >
                  Disconnect Feed
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
