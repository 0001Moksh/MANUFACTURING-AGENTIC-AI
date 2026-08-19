import React from 'react';
import { rules } from '../../data/mockData';

export const RulesBuilder: React.FC = () => {
  return (
    <div>
      <div className="flex flex-col gap-[10px]">
        {rules.map((r, i) => (
          <div key={i} className="bg-panel border border-border-color rounded-[11px] p-[14px_16px] text-[12.5px]">
            <span className="text-muted">{r[0]}</span> <b className="text-ink">{r[1]}</b><br />
            <span className="text-muted">THEN</span> {r[2]}
            <div className="mt-[8px] flex gap-[8px] flex-wrap">
              <span className="bg-canvas rounded-[6px] p-[3px_8px] text-[10.5px] text-muted font-mono">No-code rule builder</span>
              <span className="bg-canvas rounded-[6px] p-[3px_8px] text-[10.5px] text-muted font-mono">Editable by Plant Digital Head</span>
              <span className="bg-canvas rounded-[6px] p-[3px_8px] text-[10.5px] text-muted font-mono">Full audit trail</span>
            </div>
          </div>
        ))}
      </div>
      <button 
        onClick={() => alert('In the live product, this opens a no-code rule builder: IF <signal> THEN <notify/act>, with escalation timers.')}
        className="mt-[14px] bg-navy-900 text-white border-none rounded-[9px] p-[9px_15px] text-[12.5px] font-bold cursor-pointer hover:bg-navy-800 transition-colors"
      >
        + Add escalation rule
      </button>
    </div>
  );
};
