import React from 'react';
import { Search } from 'lucide-react';
import { pillarMeta } from '../../data/mockData';

interface FilterBarProps {
  activePillar: string;
  setActivePillar: (p: string) => void;
  activeType: string;
  setActiveType: (t: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  activePillar, setActivePillar,
  activeType, setActiveType,
  searchQuery, setSearchQuery,
  resultCount
}) => {
  const types = ["all", "AGENTIC", "GENAI", "ML", "VISION", "IOT", "VOICE"];
  
  return (
    <div className="mb-[16px]">
      <div className="flex justify-between items-center gap-[16px] mb-[18px] flex-wrap">
        <div className="flex flex-wrap gap-[8px]">
          <button
            onClick={() => setActivePillar('all')}
            className={`border rounded-[20px] py-[6px] px-[13px] text-[12px] font-semibold transition-colors cursor-pointer ${
              activePillar === 'all' ? 'bg-navy-900 text-white border-navy-900' : 'bg-panel border-border-color text-muted hover:text-ink'
            }`}
          >
            All Pillars
          </button>
          {Object.entries(pillarMeta).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setActivePillar(k)}
              className={`border rounded-[20px] py-[6px] px-[13px] text-[12px] font-semibold transition-colors cursor-pointer ${
                activePillar === k ? 'bg-navy-900 text-white border-navy-900' : 'bg-panel border-border-color text-muted hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-[8px] border border-border-color bg-panel rounded-[9px] py-[8px] px-[12px] min-w-[230px] focus-within:border-teal transition-colors">
          <Search className="w-[14px] h-[14px] text-[#98A2BE]" />
          <input 
            type="text" 
            placeholder="Search use cases…" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none outline-none text-[12.5px] w-full font-body bg-transparent text-ink placeholder:text-[#98A2BE]"
          />
        </div>
      </div>
      
      <div className="flex flex-wrap gap-[8px] mb-[12px]">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`border rounded-[20px] py-[6px] px-[13px] text-[12px] font-semibold transition-colors cursor-pointer ${
              activeType === t ? 'bg-navy-900 text-white border-navy-900' : 'bg-panel border-border-color text-muted hover:text-ink'
            }`}
          >
            {t === 'all' ? 'All Types' : t}
          </button>
        ))}
      </div>
      
      <div className="text-[12px] text-muted">
        {resultCount} of 23 use cases
      </div>
    </div>
  );
};
