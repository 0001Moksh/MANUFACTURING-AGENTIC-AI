import React from 'react';

export const ExecutiveSummaryCard: React.FC = () => {
  return (
    <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden flex flex-col h-full">
      <div className="p-[16px_18px] border-b border-border-color bg-[#FAFBFE]">
        <h3 className="font-head text-[14.5px] m-0 font-bold">AI Executive Summary</h3>
      </div>
      
      <div className="p-[14px_18px] overflow-y-auto">
        <div className="mb-[16px]">
          <span className="inline-block text-[10px] font-bold tracking-[0.5px] py-[3px] px-[8px] rounded-[5px] mb-[8px] bg-red-tint text-red uppercase">
            Requires Action
          </span>
          <ul className="m-0 pl-[16px] text-[12px] text-muted space-y-[5px] list-disc marker:text-red">
            <li>Train-3 regenerator fault — ₹4.2M at risk, 72h failure window</li>
            <li>Unit 5 SO₂ breach risk within 96h</li>
            <li>4 expired permits · Site Zeta re-audit due</li>
          </ul>
        </div>

        <div className="mb-[16px]">
          <span className="inline-block text-[10px] font-bold tracking-[0.5px] py-[3px] px-[8px] rounded-[5px] mb-[8px] bg-amber-tint text-[#9A6400] uppercase">
            Decisions This Week
          </span>
          <ul className="m-0 pl-[16px] text-[12px] text-muted space-y-[5px] list-disc marker:text-[#9A6400]">
            <li>Approve Train-3 PO-2026-0847</li>
            <li>Q3 turnaround extension review</li>
            <li>Investigate HIPO #2026-114</li>
          </ul>
        </div>

        <div>
          <span className="inline-block text-[10px] font-bold tracking-[0.5px] py-[3px] px-[8px] rounded-[5px] mb-[8px] bg-green-tint text-green uppercase">
            Positive Signals
          </span>
          <ul className="m-0 pl-[16px] text-[12px] text-muted space-y-[5px] list-disc marker:text-green">
            <li>Zero Harm Index 94.6, up 1.2%</li>
            <li>OEE 83.7% — above target</li>
            <li>142 days LTI-free · TRIR down 12.5%</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
