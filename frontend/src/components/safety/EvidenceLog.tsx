import React, { useState, useEffect } from 'react';

interface Evidence {
  id: number;
  label: string;
  timestamp: string;
  imageUrl: string;
}

export const EvidenceLog: React.FC = () => {
  const [evidenceLog, setEvidenceLog] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/video-monitoring/evidence')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setEvidenceLog(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch evidence log from database.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-muted text-sm bg-surface p-4 rounded-xl">Loading evidence log...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm font-semibold">
        {error}
      </div>
    );
  }

  if (evidenceLog.length === 0) {
    return (
      <div className="bg-surface border border-border-color text-muted rounded-xl p-4 text-sm">
        No recent evidence snapshots found in the database.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {evidenceLog.map(evidence => (
        <div key={evidence.id} className="bg-surface rounded-xl border border-border-color overflow-hidden flex flex-col p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="aspect-video bg-slate-200 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
             {evidence.imageUrl ? (
               <img src={evidence.imageUrl} alt={evidence.label} className="object-cover w-full h-full rounded-lg" />
             ) : (
               <span className="text-slate-400 text-xs text-center px-2">Image Not Available</span>
             )}
          </div>
          <p className="text-sm font-semibold text-ink truncate" title={evidence.label}>{evidence.label}</p>
          <span className="text-xs text-muted block mb-3">{evidence.timestamp}</span>
          <button className="mt-auto w-full bg-slate-900 text-white text-sm font-bold py-2 rounded hover:bg-slate-800 transition-colors">
            Inspect Full Evidence
          </button>
        </div>
      ))}
    </div>
  );
};
