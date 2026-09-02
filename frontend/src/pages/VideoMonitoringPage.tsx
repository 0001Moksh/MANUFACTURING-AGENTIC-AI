import React from 'react';
import { StreamGrid } from '../components/safety/StreamGrid';
import { AlertFeed } from '../components/safety/AlertFeed';
import { EvidenceLog } from '../components/safety/EvidenceLog';

export const VideoMonitoringPage: React.FC = () => {
  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-ink">Video Monitoring</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-[3] flex flex-col gap-6">
          <StreamGrid />
          
          {/* Chart Container Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-surface border border-border-color rounded-xl p-4 min-h-[250px] flex items-center justify-center text-muted">
                [Alert Frequency Chart Container]
             </div>
             <div className="bg-surface border border-border-color rounded-xl p-4 min-h-[250px] flex items-center justify-center text-muted">
                [Severity Distribution Chart Container]
             </div>
          </div>
        </div>
        
        <div className="flex-[1] min-w-[300px]">
          <AlertFeed />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-ink mb-4">Snapshot & Visual Evidence Log</h2>
        <EvidenceLog />
      </div>
    </div>
  );
};
