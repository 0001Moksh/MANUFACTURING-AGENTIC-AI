import React, { useState, useEffect } from 'react';

interface Alert {
  id: number;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
  message: string;
  timestamp: string;
}

export const AlertFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/video-monitoring/stream');

    eventSource.onmessage = (event) => {
      try {
        const newAlert = JSON.parse(event.data);
        setAlerts((prev) => [newAlert, ...prev].slice(0, 50)); // Keep last 50
        setError(null);
      } catch (e) {
        console.error("Failed to parse alert data", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      setError('Live connection lost. Attempting to reconnect...');
      eventSource.close();
      // In a real app, implement a retry backoff here
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const getSeverityStyle = (severity: string) => {
    switch(severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'WARNING': return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'NORMAL': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/30';
    }
  };

  const getBadgeStyle = (severity: string) => {
    switch(severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500 text-white';
      case 'WARNING': return 'bg-amber-500 text-white';
      case 'NORMAL': return 'bg-emerald-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="bg-surface rounded-xl shadow-lg border border-border-color h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border-color">
        <h3 className="font-bold text-lg text-ink">Real-Time Violation Feed</h3>
        <p className="text-xs text-muted">Auto-scrolling as construction_ai.alerts updates</p>
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200 text-red-600 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {alerts.length === 0 && !error && (
           <div className="flex items-center justify-center h-full text-muted text-sm">
             Listening for live alerts...
           </div>
        )}
        {alerts.map((alert, index) => (
          <div key={`${alert.id}-${index}`} className="relative pl-6">
            <div className={`absolute left-0 top-2 w-2 h-2 rounded-full ${getBadgeStyle(alert.severity)}`}></div>
            <div className="absolute left-[3px] top-4 bottom-[-16px] w-[2px] bg-border-color"></div>
            
            <div className={`p-3 rounded-lg border ${getSeverityStyle(alert.severity)}`}>
              <span className={`px-2 py-1 text-xs font-bold rounded mb-2 inline-block ${getBadgeStyle(alert.severity)}`}>
                {alert.severity}
              </span>
              <p className="text-sm font-medium">{alert.message}</p>
              <span className="text-xs opacity-70 mt-1 block">{alert.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
