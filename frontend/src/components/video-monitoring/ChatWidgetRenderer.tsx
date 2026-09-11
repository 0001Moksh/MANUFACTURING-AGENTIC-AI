import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Eye, Table as TableIcon, Image as ImageIcon, Maximize2, Minimize2, X } from 'lucide-react';

export interface WidgetPayload {
  type: 'evidence_gallery' | 'snapshot_evidence_widget' | 'data_table' | 'hitl_actions' | 'live_stream_player';
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
  // Live Stream Player fields
  camera_name?: string;
  camera_location?: string;
  stream_url?: string;
  snapshot_url?: string;
  snapshot_path?: string;
  captured_at?: string;
  frame_count?: number;
  capture_source?: string;
  user_query?: string;
  vlm_instruction?: string;
  vlm_response?: string;
  detections?: Array<Record<string, unknown>>;
  vlm_detections?: Array<{
    entity: string;
    class: string;
    confidence: number;
    helmet: boolean | null;
    vest: boolean | null;
  }>;
  fps?: number;
  resolution?: string;
  status?: string;
}

interface ChatWidgetRendererProps {
  payload: WidgetPayload;
  onActionClick?: (actionId: string, label: string) => void;
}

export const ChatWidgetRenderer: React.FC<ChatWidgetRendererProps> = ({ payload, onActionClick }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [streamOpen, setStreamOpen] = useState(true);
  const [streamFullscreen, setStreamFullscreen] = useState(false);

  if (payload.type === 'snapshot_evidence_widget') {
    return (
      <div className="mt-3 w-full max-w-[430px] p-3 bg-slate-900/95 border border-emerald-500/30 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 mb-2.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <ImageIcon className="w-4 h-4" />
          <span>{payload.title || 'Live Snapshot Evidence'}</span>
          <span className="ml-auto text-[10px] text-slate-400 normal-case">1 frame</span>
        </div>
        <div className="relative w-full max-w-[400px] max-h-[225px] aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700">
          <img
            src={payload.snapshot_url}
            alt={`Captured live snapshot — ${payload.camera_name}`}
            className="w-full h-full max-w-[400px] max-h-[225px] object-cover rounded-lg cursor-pointer"
            onClick={() => setSelectedImage(payload.snapshot_url || null)}
          />
          <button
            type="button"
            aria-label="Expand snapshot"
            title="Expand snapshot"
            onClick={() => setSelectedImage(payload.snapshot_url || null)}
            className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1.5 text-white hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <span className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[10px] font-mono text-white bg-slate-950/80 rounded">
            {payload.camera_name}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-slate-400 font-mono">
          <span>{payload.capture_source || 'RTSP live frame'}</span>
          <span>{payload.captured_at ? new Date(payload.captured_at).toLocaleTimeString() : 'Just captured'}</span>
        </div>
        {payload.vlm_response && (
          <div className="mt-2 border-t border-slate-700 pt-2 prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-emerald-300">
            <ReactMarkdown remarkPlugins={[remarkGfm as any]}>{payload.vlm_response}</ReactMarkdown>
          </div>
        )}
        {selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden p-2" onClick={(event) => event.stopPropagation()}>
              <img src={selectedImage} alt={`Expanded snapshot — ${payload.camera_name}`} className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 bg-slate-800/90 text-white p-1.5 rounded-full hover:bg-slate-700 transition-colors"
                aria-label="Close snapshot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (payload.type === 'live_stream_player') {
    if (!streamOpen) return null;

    return (
      <div className={`mt-3 w-full ${streamFullscreen ? 'fixed inset-0 z-50 max-w-none h-screen p-5 bg-slate-950/95' : 'max-w-[430px] p-3'} border border-cyan-500/30 rounded-xl shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">LIVE</span>
          </div>
          <span className="text-cyan-400 font-semibold text-xs uppercase tracking-wider truncate">
            {payload.title || `Live Feed — ${payload.camera_name}`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStreamFullscreen((value) => !value)}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              aria-label={streamFullscreen ? 'Exit fullscreen stream' : 'Expand live stream'}
              title={streamFullscreen ? 'Exit fullscreen' : 'Expand live stream'}
            >
              {streamFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setStreamOpen(false)}
              className="p-1.5 text-slate-300 hover:text-red-300 hover:bg-red-950/60 rounded-md transition-colors"
              aria-label="Close live stream"
              title="Close live stream"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Stream Frame */}
        <div className={`relative w-full ${streamFullscreen ? 'h-[calc(100vh-90px)] max-w-none' : 'max-w-[400px]'} aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-700 mb-2.5`}>
          {!streamError ? (
            <img
              src={payload.stream_url}
              alt={`Live stream — ${payload.camera_name}`}
              className="w-full h-full object-cover rounded-lg"
              onError={() => setStreamError(true)}
            />
          ) : (
            /* Fallback snapshot when MJPEG stream fails to load */
            <img
              src={payload.snapshot_url}
              alt={`Snapshot — ${payload.camera_name}`}
              className="w-full h-full object-cover opacity-80 rounded-lg"
            />
          )}

          {/* Overlay HUD */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center px-2.5 gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-white font-mono">{payload.camera_name}</span>
              <span className="ml-auto text-[10px] text-slate-400 font-mono">
                {payload.resolution} · {payload.fps} FPS
              </span>
            </div>
            {/* Bottom info */}
            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-slate-950/90 to-transparent flex items-center px-2.5">
              <span className="text-[10px] text-slate-400 font-mono">{payload.camera_location}</span>
              <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${payload.status === 'STREAMING' ? 'bg-emerald-900/80 text-emerald-400' : 'bg-red-900/80 text-red-400'}`}>
                {payload.status || 'STREAMING'}
              </span>
            </div>
            {/* Corner scan lines effect */}
            <div className="absolute top-8 left-0 w-6 h-6 border-l-2 border-t-2 border-cyan-400/50" />
            <div className="absolute top-8 right-0 w-6 h-6 border-r-2 border-t-2 border-cyan-400/50" />
            <div className="absolute bottom-8 left-0 w-6 h-6 border-l-2 border-b-2 border-cyan-400/50" />
            <div className="absolute bottom-8 right-0 w-6 h-6 border-r-2 border-b-2 border-cyan-400/50" />
          </div>
        </div>
      </div>
    );
  }

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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${isSuccess
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
