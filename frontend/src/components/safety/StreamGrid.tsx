import React, { useState, useEffect } from 'react';

interface Device {
  id: number;
  name: string;
  ip: string;
  port: number;
  camera_number: string;
  status: string;
}

export const StreamGrid: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStreams, setActiveStreams] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/video-monitoring/devices')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setDevices(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Database Connection Unavailable');
        setLoading(false);
      });
  }, []);

  const toggleStream = (id: number) => {
    setActiveStreams(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div className="animate-pulse flex space-x-4 bg-surface p-4 rounded-xl">Loading cameras...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <h3 className="font-bold text-lg mb-2">Error Loading Devices</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="bg-surface border border-border-color text-muted rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <h3 className="font-bold text-lg mb-2">No Cameras Found</h3>
        <p>No active cameras registered in construction_ai.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {devices.map(device => {
        const isStreaming = activeStreams.has(device.id);
        
        return (
          <div key={device.id} className="bg-surface rounded-xl overflow-hidden shadow-lg border border-border-color flex flex-col">
            <div className="px-4 py-2 bg-slate-900 text-white flex justify-between items-center text-sm">
              <span className="font-semibold">{device.name || `Cam ${device.camera_number}`}</span>
              <div className="flex items-center space-x-2">
                <span className={`font-bold flex items-center ${device.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>
                   {device.status?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
            </div>
            
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {isStreaming ? (
                <div className="text-emerald-400 flex flex-col items-center">
                  <span className="animate-pulse mb-2 text-4xl">&bull;</span>
                  <span>Live RTSP Stream active</span>
                  <span className="text-xs text-slate-500 mt-2">{device.ip}:{device.port}</span>
                </div>
              ) : (
                <button 
                  onClick={() => toggleStream(device.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Show Live Feed
                </button>
              )}
            </div>
            
            <div className="p-3 bg-slate-900 flex items-center justify-between text-white text-sm min-h-[44px]">
              {isStreaming && (
                 <button 
                    onClick={() => toggleStream(device.id)}
                    className="text-red-400 hover:text-red-300 text-xs uppercase font-bold"
                 >
                   Disconnect Stream
                 </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
