import React from 'react';
import { StreamGrid } from '../components/safety/StreamGrid';
import { AlertFeed } from '../components/safety/AlertFeed';
import { EvidenceLog } from '../components/safety/EvidenceLog';

export const ComputerVisionSafetyMonitoringPage: React.FC = () => {
  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-ink">Computer Vision Safety & Site Monitoring</h1>
        <div className="bg-emerald-500/20 text-emerald-500 px-4 py-2 rounded-full font-semibold flex items-center">
          <span className="animate-pulse mr-2 text-xl leading-none">&bull;</span>
          4 Cameras Streaming Live
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-[3]">
          <StreamGrid />
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
