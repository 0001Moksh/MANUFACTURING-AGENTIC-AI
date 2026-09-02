import React, { useState, useEffect } from 'react';

interface Evidence {
  id: number;
  label: string;
  timestamp: string;
  imageUrl: string;
}

export const EvidenceLog: React.FC = () => {
  const [evidenceLog, setEvidenceLog] = useState<Evidence[]>([]);

  useEffect(() => {
    // In a real app, this would fetch from /api/cv-safety/evidence
    setEvidenceLog([
      { id: 1, label: 'No Hardhat', timestamp: '14:32:05', imageUrl: '' },
      { id: 2, label: 'No Hardhat', timestamp: '14:32:12', imageUrl: '' },
      { id: 3, label: 'No Hardhat', timestamp: '14:30:06', imageUrl: '' },
      { id: 4, label: 'No Hardhat', timestamp: '14:32:03', imageUrl: '' },
    ]);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {evidenceLog.map(evidence => (
        <div key={evidence.id} className="bg-surface rounded-xl border border-border-color overflow-hidden flex flex-col p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="aspect-video bg-slate-200 rounded-lg flex items-center justify-center mb-3">
             <span className="text-slate-400 text-sm">Image Placeholder</span>
          </div>
          <p className="text-sm font-semibold text-ink">{evidence.label} - {evidence.timestamp}</p>
          <button className="mt-3 w-full bg-slate-900 text-white text-sm font-bold py-2 rounded hover:bg-slate-800 transition-colors">
            Inspect Full Evidence
          </button>
        </div>
      ))}
    </div>
  );
};
