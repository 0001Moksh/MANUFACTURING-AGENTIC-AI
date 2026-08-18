import React, { useEffect, useState } from 'react';
import { connectors } from '../../data/mockData';
import { useStore } from '../../store';

export const ConnectorsGrid: React.FC = () => {
  const { telemetryStats } = useStore();
  const dbStatus = telemetryStats?.mes_db_status;
  const [integrationStates, setIntegrationStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('http://localhost:8000/api/admin/integrations')
      .then(r => r.json())
      .then(data => {
        const states: Record<string, boolean> = {};
        data.forEach((d: any) => states[d.name] = d.is_enabled);
        setIntegrationStates(states);
      })
      .catch(console.error);
  }, []);

  const toggleIntegration = async (name: string, currentState: boolean) => {
    const newState = !currentState;
    try {
      const res = await fetch('http://localhost:8000/api/admin/integrations/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, enabled: newState })
      });
      if (res.ok) {
        setIntegrationStates(prev => ({ ...prev, [name]: newState }));
      }
    } catch (e) {
      console.error('Failed to toggle', e);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
      {connectors.map((c, i) => {
        let title = c[1];
        if (title === 'CCTV / NVR (Vision AI)') title = 'Video Analytics';
        const isToggleable = title === 'MES / SCADA / PLC' || title === 'Video Analytics';
        const integrationKey = title === 'MES / SCADA / PLC' ? 'MES' : title;
        const isEnabled = integrationStates[integrationKey] ?? true;

        return (
          <div key={i} className={`border border-border-color bg-panel rounded-[12px] p-[15px_16px] flex flex-col gap-[8px] hover:shadow-sm transition-shadow ${isToggleable && !isEnabled ? 'opacity-60 grayscale-[0.2]' : ''}`}>
            <div className="flex items-center gap-[10px]">
              <div className="w-[32px] h-[32px] rounded-[8px] bg-canvas flex items-center justify-center text-[15px] shrink-0">
                {c[0]}
              </div>
              <div className="font-bold text-[13px] flex-1 truncate">
                {title}
              </div>
            </div>
            <div className="text-[11.5px] text-muted leading-[1.45] flex-1">
              {c[2]}
            </div>
            <div className="flex justify-between items-center mt-[4px]">
              {title === 'MES / SCADA / PLC' ? (
                dbStatus?.connected && isEnabled ? (
                  <div className="inline-flex items-center gap-[5px] text-[10.5px] font-bold text-green bg-green-tint py-[3px] px-[9px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-green animate-pulse" />
                    SQL Server (mes_new)
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-[5px] text-[10.5px] font-bold text-[#9A6400] bg-amber-tint py-[3px] px-[9px] rounded-[20px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-amber animate-pulse" />
                    {isEnabled ? 'Local SQLite' : 'Disconnected'}
                  </div>
                )
              ) : (
                <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${
                  (!isToggleable || isEnabled) && c[3] === 'Connected' ? 'bg-green-tint text-green' : c[3] === 'Pilot' ? 'bg-amber-tint text-[#9A6400]' : 'bg-[#EEF0F5] text-muted'
                }`}>
                  {isToggleable && !isEnabled ? 'Disabled' : c[3]}
                </span>
              )}
              
              {isToggleable ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleIntegration(integrationKey, isEnabled);
                  }}
                  className={`flex items-center gap-[6px] border rounded-[20px] py-[4px] px-[10px] text-[11px] font-semibold transition-colors cursor-pointer ${
                    isEnabled 
                      ? 'bg-green-tint border-green/20 text-green hover:bg-green/10' 
                      : 'bg-canvas border-border-color text-muted hover:bg-black/5'
                  }`}
                >
                  <div className={`w-[8px] h-[8px] rounded-full ${isEnabled ? 'bg-green' : 'bg-gray-400'}`} />
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              ) : (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    alert('Opens connector configuration — credentials, field mapping and sync frequency.');
                  }}
                  className="bg-canvas border border-border-color rounded-[7px] py-[5px] px-[11px] text-[11px] font-semibold text-ink hover:bg-black/5 transition-colors cursor-pointer"
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
