import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Eye, Table as TableIcon, Image as ImageIcon, X } from 'lucide-react';

export interface WidgetPayload {
  type: 'evidence_gallery' | 'data_table' | 'hitl_actions';
  title?: string;
  description?: string;
  snapshots?: Array<{
    id: number;
    title: string;
    timestamp: string;
    url: string;
    badge?: string;
  }>;
  headers?: string[];
  rows?: string[][];
  actions?: Array<{
    id: string;
    label: string;
    variant?: 'success' | 'danger' | 'secondary' | 'primary';
  }>;
}

interface ChatWidgetRendererProps {
  payload: WidgetPayload;
  onActionClick?: (actionId: string, label: string) => void;
}

export const ChatWidgetRenderer: React.FC<ChatWidgetRendererProps> = ({ payload, onActionClick }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (payload.type === 'evidence_gallery') {
    return (
      <div className="mt-3 p-3 bg-slate-900/90 border border-amber-500/30 rounded-xl shadow-lg">
        <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span>{payload.title || 'Evidence Snapshots'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {payload.snapshots?.map((snap) => (
            <div
              key={snap.id}
              onClick={() => setSelectedImage(snap.url)}
              className="relative group cursor-pointer overflow-hidden rounded-lg border border-slate-700 hover:border-amber-400 transition-all bg-slate-950"
            >
              <img src={snap.url} alt={snap.title} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
              {snap.badge && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-bold bg-red-600/90 text-white rounded">
                  {snap.badge}
                </span>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 text-[10px] text-slate-300 truncate flex items-center justify-between">
                <span>{snap.timestamp}</span>
                <Eye className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ))}
        </div>

        {/* Modal viewer */}
        {selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-xl w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden p-2">
              <img src={selectedImage} alt="Expanded Evidence" className="w-full h-auto rounded-lg" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-slate-800/90 text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (payload.type === 'data_table') {
    return (
      <div className="mt-3 p-3 bg-slate-900/90 border border-cyan-500/30 rounded-xl shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 mb-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
          <TableIcon className="w-4 h-4 text-cyan-400" />
          <span>{payload.title || 'Data Insights'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700">
                {payload.headers?.map((h, i) => (
                  <th key={i} className="py-1.5 px-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {payload.rows?.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="py-1.5 px-2">
                      {cell.includes('ONLINE') ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {cell}
                        </span>
                      ) : cell.includes('OFFLINE') ? (
                        <span className="text-red-400 font-medium">{cell}</span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (payload.type === 'hitl_actions') {
    return (
      <div className="mt-3 p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl shadow-xl">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4 text-amber-400 animate-bounce" />
          <span>{payload.title || 'Governance Confirmation Required'}</span>
        </div>
        {payload.description && (
          <p className="text-xs text-slate-300 mt-1.5 mb-3 leading-relaxed">
            {payload.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {payload.actions?.map((act) => {
            const isSuccess = act.variant === 'success';
            const isDanger = act.variant === 'danger';
            return (
              <button
                key={act.id}
                onClick={() => onActionClick?.(act.id, act.label)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                  isSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
                    : isDanger
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isSuccess && <CheckCircle2 className="w-3.5 h-3.5" />}
                {isDanger && <XCircle className="w-3.5 h-3.5" />}
                {!isSuccess && !isDanger && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
