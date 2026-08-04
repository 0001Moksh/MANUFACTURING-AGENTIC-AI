import React from 'react';
import { connectors } from '../../data/mockData';

export const ConnectorsGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
      {connectors.map((c, i) => (
        <div key={i} className="border border-border-color bg-panel rounded-[12px] p-[15px_16px] flex flex-col gap-[8px] hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-canvas flex items-center justify-center text-[15px] shrink-0">
              {c[0]}
            </div>
            <div className="font-bold text-[13px] flex-1 truncate">
              {c[1]}
            </div>
          </div>
          <div className="text-[11.5px] text-muted leading-[1.45] flex-1">
            {c[2]}
          </div>
          <div className="flex justify-between items-center mt-[4px]">
            <span className={`text-[10.5px] font-bold py-[3px] px-[9px] rounded-[20px] ${
              c[3] === 'Connected' ? 'bg-green-tint text-green' : c[3] === 'Pilot' ? 'bg-amber-tint text-[#9A6400]' : 'bg-[#EEF0F5] text-muted'
            }`}>
              {c[3]}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                alert('Opens connector configuration — credentials, field mapping and sync frequency.');
              }}
              className="bg-canvas border border-border-color rounded-[7px] py-[5px] px-[11px] text-[11px] font-semibold text-ink hover:bg-black/5 transition-colors cursor-pointer"
            >
              Configure
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
