import React, { useState, useEffect } from 'react';

interface Device {
  id: number;
  name: string;
  zone: string;
  status: string;
}

export const StreamGrid: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, this would fetch from /api/cv-safety/devices
    setDevices([
      { id: 1, name: 'CAM-01', zone: 'Zone A - Conveyor Line', status: 'LIVE' },
      { id: 2, name: 'CAM-02', zone: 'Zone B - Restricted Area', status: 'LIVE' },
      { id: 3, name: 'CAM-03', zone: 'Zone C - Loading Dock', status: 'LIVE' },
      { id: 4, name: 'CAM-04', zone: 'Zone D - Main Floor', status: 'LIVE' },
    ]);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="animate-pulse flex space-x-4">Loading streams...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {devices.map(device => (
        <div key={device.id} className="bg-surface rounded-xl overflow-hidden shadow-lg border border-border-color flex flex-col">
          <div className="px-4 py-2 bg-slate-900 text-white flex justify-between items-center text-sm">
            <span className="font-semibold">{device.name}: {device.zone}</span>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-bold flex items-center">
                <span className="animate-pulse mr-1">&bull;</span> {device.status} | 30 FPS
              </span>
            </div>
          </div>
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {/* Placeholder for actual stream */}
            <div className="text-slate-500">Live Stream {device.name}</div>
          </div>
          <div className="p-3 bg-slate-900 flex items-center justify-between text-white text-sm">
             <label className="flex items-center space-x-2 cursor-pointer">
               <input type="checkbox" className="form-checkbox h-4 w-4 text-emerald-500" />
               <span>Show AI Detection Overlay</span>
             </label>
          </div>
        </div>
      ))}
    </div>
  );
};
