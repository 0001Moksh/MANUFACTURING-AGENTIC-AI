import React, { useState, useEffect } from 'react';

interface Alert {
  id: number;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
  message: string;
  timestamp: string;
}

export const AlertFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let isMounted = true;

    const connectStream = () => {
      es = new EventSource('/api/video-monitoring/stream');

      es.onopen = () => {
        if (isMounted) {
          setError(null);
          setIsConnecting(false);
        }
      };

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const newAlert = JSON.parse(event.data);
          setAlerts((prev) => {
            // Deduplicate by ID
            if (prev.some(a => a.id === newAlert.id)) return prev;
            return [newAlert, ...prev].slice(0, 50);
          });
          setError(null);
          setIsConnecting(false);
        } catch (e) {
          console.error("Failed to parse alert data", e);
        }
      };

      es.onerror = (err) => {
        if (!isMounted) return;
        // Don't close EventSource here, allow browser's native auto-reconnect
        if (es?.readyState === EventSource.CONNECTING) {
          setIsConnecting(true);
        } else if (es?.readyState === EventSource.CLOSED) {
          setError('Live alert stream disconnected. Retrying connection...');
        }
      };
    };

    connectStream();

    return () => {
      isMounted = false;
      if (es) {
        es.close();
      }
    };
  }, []);

  const getSeverityStyle = (severity: string) => {
    switch(severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'WARNING': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'NORMAL': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const getBadgeStyle = (severity: string) => {
    switch(severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'WARNING': return 'bg-amber-600 text-white';
      case 'NORMAL': return 'bg-emerald-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg text-slate-100">Real-Time Violation Feed</h3>
          <p className="text-xs text-slate-400">Auto-scrolling live updates from construction_ai.alerts</p>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`}></span>
          <span className="text-[11px] font-mono text-slate-400">{isConnecting ? 'RECONNECTING' : 'STREAM ACTIVE'}</span>
        </div>
      </div>
      
      {error && (
        <div className="px-4 py-2 bg-amber-950/60 border-b border-amber-800/60 text-amber-300 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[600px]">
        {alerts.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm space-y-2 py-12">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Listening for live alerts in construction_ai...</span>
          </div>
        )}
        {alerts.map((alert, index) => (
          <div key={`${alert.id}-${index}`} className="relative pl-6">
            <div className={`absolute left-0 top-2.5 w-2.5 h-2.5 rounded-full ${getBadgeStyle(alert.severity)}`}></div>
            <div className="absolute left-[4px] top-5 bottom-[-16px] w-[2px] bg-slate-800"></div>
            
            <div className={`p-3 rounded-lg border ${getSeverityStyle(alert.severity)} shadow-sm`}>
              <div className="flex justify-between items-center mb-1.5">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${getBadgeStyle(alert.severity)}`}>
                  {alert.severity}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{alert.timestamp}</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
