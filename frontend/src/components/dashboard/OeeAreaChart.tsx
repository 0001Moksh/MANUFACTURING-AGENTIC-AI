import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '08:00', oee: 78, target: 82 },
  { time: '10:00', oee: 81, target: 82 },
  { time: '12:00', oee: 80, target: 82 },
  { time: '14:00', oee: 84, target: 82 },
  { time: '16:00', oee: 85, target: 82 },
  { time: '18:00', oee: 83.6, target: 82 },
];

export const OeeAreaChart: React.FC = () => {
  return (
    <div className="bg-panel border border-border-color rounded-[14px] overflow-hidden flex flex-col h-full min-h-[350px]">
      <div className="p-[16px_18px] border-b border-border-color flex items-center justify-between">
        <h3 className="font-head text-[14.5px] m-0 font-bold">Plant OEE Trend (Today)</h3>
        <div className="flex gap-[12px] text-[11px] font-semibold">
          <div className="flex items-center gap-[4px]">
            <div className="w-[8px] h-[8px] rounded-full bg-teal" />
            <span className="text-muted">Actual OEE</span>
          </div>
          <div className="flex items-center gap-[4px]">
            <div className="w-[8px] h-[8px] rounded-full bg-amber" />
            <span className="text-muted">Target (82%)</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-[14px_18px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOee" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00A9AE" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00A9AE" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E3E7F0" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#98A2BE' }} tickLine={false} axisLine={false} dy={10} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#98A2BE' }} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
              itemStyle={{ fontWeight: 600 }}
            />
            <Area type="monotone" dataKey="target" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" fill="none" />
            <Area type="monotone" dataKey="oee" stroke="#00A9AE" strokeWidth={3} fillOpacity={1} fill="url(#colorOee)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
