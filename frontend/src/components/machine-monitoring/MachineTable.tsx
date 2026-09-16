import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, AlertTriangle, ChevronRight,
  ChevronUp, ChevronDown
} from 'lucide-react';
import type { Machine } from '../../data/machineMonitoringData';
import { STATUS_COLOR, STATUS_BG, HEALTH_COLOR } from './MachineCard';

interface MachineTableProps {
  machines: Machine[];
}

type SortField = 'name' | 'healthScore' | 'plant' | 'status' | 'activeIssues' | 'lastUpdated';

export const MachineTable: React.FC<MachineTableProps> = ({ machines }) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('healthScore');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sorted = useMemo(() => {
    return [...machines].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [machines, sortField, sortAsc]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3.5 h-3.5 text-teal inline ml-1" /> : <ChevronDown className="w-3.5 h-3.5 text-teal inline ml-1" />;
  };

  return (
    <div className="bg-panel border border-border rounded-[14px] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-border text-muted font-bold uppercase text-[10.5px] tracking-[0.5px] select-none">
              <th className="py-3 px-4 cursor-pointer hover:text-ink" onClick={() => handleSort('name')}>
                Machine / Code {renderSortIcon('name')}
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-ink" onClick={() => handleSort('plant')}>
                Plant & Line {renderSortIcon('plant')}
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-ink text-center" onClick={() => handleSort('healthScore')}>
                Health Index {renderSortIcon('healthScore')}
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-ink" onClick={() => handleSort('status')}>
                Status {renderSortIcon('status')}
              </th>
              <th className="py-3 px-3">Live Telemetry Signals</th>
              <th className="py-3 px-3 cursor-pointer hover:text-ink text-center" onClick={() => handleSort('activeIssues')}>
                Active Issues {renderSortIcon('activeIssues')}
              </th>
              <th className="py-3 px-3">AI Agent State</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.map((m) => {
              const statusColor = STATUS_COLOR[m.status];
              const healthColor = HEALTH_COLOR(m.healthScore, m.status);

              return (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/machine-monitoring/${m.id}`)}
                  className="hover:bg-teal/5 cursor-pointer transition-colors group"
                >
                  {/* Machine Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: statusColor }}
                      />
                      <div>
                        <div className="font-head font-bold text-ink group-hover:text-teal transition-colors">
                          {m.name}
                        </div>
                        <div className="font-mono text-[11px] text-muted">{m.code} • {m.type}</div>
                      </div>
                    </div>
                  </td>

                  {/* Plant & Line */}
                  <td className="py-3 px-3">
                    <div className="font-medium text-ink">{m.plant}</div>
                    <div className="text-[11px] text-muted">{m.line}</div>
                  </td>

                  {/* Health Index */}
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-[#F8FAFC]">
                      <span className="w-2 h-2 rounded-full" style={{ background: healthColor }} />
                      <span className="font-mono font-extrabold text-[13px]" style={{ color: healthColor }}>
                        {m.status === 'Offline' ? '—' : `${m.healthScore}%`}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{ background: STATUS_BG[m.status], color: statusColor }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                      {m.status}
                    </span>
                  </td>

                  {/* Live Metrics Summary */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      {m.liveMetrics.slice(0, 3).map((metric) => (
                        <div key={metric.key} className="text-[11px]">
                          <span className="text-muted mr-1">{metric.label.slice(0, 4)}:</span>
                          <span className="font-mono font-bold text-ink">{metric.value}{metric.unit}</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Active Issues */}
                  <td className="py-3 px-3 text-center">
                    {m.activeIssues > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono text-[11px] font-bold border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        {m.activeIssues} Active
                      </span>
                    ) : m.status === 'Offline' ? (
                      <span className="text-muted text-[11px]">Offline</span>
                    ) : (
                      <span className="text-emerald-700 text-[11px] font-medium">Nominal</span>
                    )}
                  </td>

                  {/* AI Agent State */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
                      <Bot className="w-3.5 h-3.5 text-teal shrink-0" />
                      <span className="truncate max-w-[130px]">{m.agentStatus}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    <button className="text-teal hover:underline text-[12px] font-bold inline-flex items-center gap-0.5">
                      <span>View</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
