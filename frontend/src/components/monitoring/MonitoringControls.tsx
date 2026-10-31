import React from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
export const RANGES = [
  { label: 'Last 30 minutes', value: 30 }, { label: 'Last 1 hour', value: 60 },
  { label: 'Last 6 hours', value: 360 }, { label: 'Last 24 hours', value: 1440 },
];
type Props = {
  rangeMinutes: number; setRangeMinutes: (value: number) => void;
  refreshInput: string; setRefreshInput: (value: string) => void;
  applyRefresh: () => void; load: () => void; loading: boolean;
};
export const MonitoringControls: React.FC<Props> = ({ rangeMinutes, setRangeMinutes, refreshInput, setRefreshInput, applyRefresh, load, loading }) => <>
        <label className="flex items-center gap-2 rounded-lg border border-[#DEE6F0] bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Clock3 className="h-4 w-4" /><select value={rangeMinutes} onChange={event => setRangeMinutes(Number(event.target.value))} className="bg-transparent outline-none">{RANGES.map(range => <option key={range.value} value={range.value}>{range.label}</option>)}</select></label>
        <div className="flex items-center overflow-hidden rounded-lg border border-[#DEE6F0] bg-white text-xs"><span className="flex items-center gap-1.5 px-2.5 text-slate-500"><RefreshCw className="h-3.5 w-3.5" />Auto</span><input aria-label="Auto refresh seconds" type="number" min="0" max="3600" value={refreshInput} onChange={event => setRefreshInput(event.target.value)} onBlur={applyRefresh} onKeyDown={event => event.key === 'Enter' && applyRefresh()} className="w-14 border-x border-[#DEE6F0] px-2 py-2 text-center font-bold outline-none" /><span className="px-2 text-slate-400">sec</span></div>
        <button onClick={() => void load()} className="rounded-lg border border-[#DEE6F0] bg-white p-2.5 text-slate-600" title="Refresh now"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
</>;
