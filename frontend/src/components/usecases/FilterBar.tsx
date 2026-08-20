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
  const types = ["all", "GENAI", "ML", "VISION", "IOT", "VOICE"];
  const pillars = ["all", ...Object.keys(pillarMeta)];

  return (
    <div className="mb-[18px] flex flex-col gap-3">
      {/* Search & Result Count Bar */}
      <div className="flex justify-between items-center gap-[16px] flex-wrap">
        <div className="flex items-center gap-[8px] border border-border-color bg-panel rounded-[9px] py-[8px] px-[12px] min-w-[280px] flex-1 max-w-[420px] focus-within:border-teal transition-colors shadow-2xs">
          <Search className="w-[14px] h-[14px] text-[#98A2BE]" />
          <input 
            type="text" 
            placeholder="Search 23 use case modules by title, tag, or description…" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none outline-none text-[12.5px] w-full font-body bg-transparent text-ink placeholder:text-[#98A2BE]"
          />
        </div>
      </div>      
    </div>
  );
};
