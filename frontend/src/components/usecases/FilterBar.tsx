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

        <div className="text-[12px] font-semibold text-muted">
          Showing <span className="text-teal font-extrabold">{resultCount}</span> use case{resultCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Pillar & Tech Tag Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color/60 pt-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
          <span className="text-[10px] font-bold text-faint uppercase tracking-wider mr-1">Pillar:</span>
          {pillars.map(p => (
            <button
              key={p}
              onClick={() => setActivePillar(p)}
              className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold transition-all cursor-pointer border-none ${
                activePillar === p
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-canvas text-muted hover:text-ink hover:bg-slate-200/60'
              }`}
            >
              {p === 'all' ? 'All Pillars' : pillarMeta[p]?.label || p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
          <span className="text-[10px] font-bold text-faint uppercase tracking-wider mr-1">Tech:</span>
          {types.map(t => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-2 py-0.5 rounded-[5px] text-[10.5px] font-bold tracking-wide uppercase transition-all cursor-pointer border-none ${
                activeType === t
                  ? 'bg-teal text-white shadow-xs'
                  : 'bg-canvas text-muted hover:text-teal-deep hover:bg-teal-tint/40'
              }`}
            >
              {t === 'all' ? 'All Tech' : t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
